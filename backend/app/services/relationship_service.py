from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Node, Relationship
from app.schemas.protocol import ProtocolRead
from app.schemas.relationship import RelationshipCreate, RelationshipRead, RelationshipUpdate


def to_relationship_read(rel: Relationship) -> RelationshipRead:
    """Builds a RelationshipRead with protocol_ids/protocols
    populated from the (already eager-loaded) `.protocols`
    collection. Callers must have loaded that collection
    first (selectinload) — this function does not touch the
    database itself.

    Each embedded ProtocolRead's own `relationship_ids` is
    set to just this relationship's id, not the protocol's
    full attachment list — getting the complete list would
    require a second level of eager loading
    (protocols -> their other relationships) for a field
    this response doesn't otherwise need. The authoritative,
    complete `relationship_ids` for a protocol is always
    available from GET /relationships/{id}/protocols or
    GET /graphs/{id}/protocols (see protocol_service.py).
    """
    data = RelationshipRead.model_validate(rel)
    data.protocol_ids = [p.id for p in rel.protocols]
    data.protocols = [
        ProtocolRead.model_validate(p).model_copy(update={"relationship_ids": [rel.id]})
        for p in rel.protocols
    ]
    return data


def _node_pair_key(node_a_id: str, node_b_id: str) -> str:
    # Order-independent key for the pair of nodes a relationship
    # connects — A->B and B->A always produce the same key. Stored on
    # Relationship.node_pair_key and backed by a DB-level
    # UNIQUE(graph_id, node_pair_key) constraint, so "only one
    # relationship per pair" holds even under a race between two
    # concurrent creates, not just the best-effort check below.
    return "|".join(sorted((node_a_id, node_b_id)))


async def _relationship_pair_exists(
    db: AsyncSession, graph_id: str, source_node_id: str, target_node_id: str
) -> bool:
    # A -> B and B -> A count as the same pair — only one
    # communication relationship is allowed between any two
    # nodes, regardless of direction.
    existing = await db.scalars(
        select(Relationship).where(
            Relationship.graph_id == graph_id,
            (
                (Relationship.source_node_id == source_node_id)
                & (Relationship.target_node_id == target_node_id)
            )
            | (
                (Relationship.source_node_id == target_node_id)
                & (Relationship.target_node_id == source_node_id)
            ),
        )
    )
    return existing.first() is not None


async def create_relationship(db: AsyncSession, graph_id: str, data: RelationshipCreate) -> Relationship:
    for node_id in (data.source_node_id, data.target_node_id):
        node = await db.get(Node, node_id)
        if node is None or node.graph_id != graph_id:
            raise ValueError("Both relationship nodes must belong to the graph.")

    if data.source_node_id == data.target_node_id:
        raise ValueError("A node cannot have a relationship with itself.")

    if await _relationship_pair_exists(db, graph_id, data.source_node_id, data.target_node_id):
        raise ValueError("A communication relationship already exists between these two nodes.")

    rel = Relationship(
        graph_id=graph_id,
        node_pair_key=_node_pair_key(data.source_node_id, data.target_node_id),
        **data.model_dump(),
    )
    db.add(rel)

    try:
        await db.commit()
    except IntegrityError:
        # Backstop for the race between the check above and this
        # insert (two concurrent creates for the same pair both
        # passing the check before either commits) — the DB-level
        # UNIQUE(graph_id, node_pair_key) constraint is what actually
        # stops the duplicate row from existing; this just turns that
        # into the same friendly error the pre-check gives.
        await db.rollback()
        raise ValueError("A communication relationship already exists between these two nodes.")

    await db.refresh(rel, attribute_names=["protocols"])
    return rel


async def list_relationships(db: AsyncSession, graph_id: str) -> list[Relationship]:
    return list(
        (
            await db.scalars(
                select(Relationship)
                .where(Relationship.graph_id == graph_id)
                .options(selectinload(Relationship.protocols))
            )
        ).all()
    )


async def update_relationship(db: AsyncSession, rel: Relationship, data: RelationshipUpdate) -> Relationship:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rel, key, value)
    await db.commit()
    await db.refresh(rel, attribute_names=["protocols"])
    return rel


async def delete_relationship(db: AsyncSession, rel: Relationship) -> None:
    # Cascades to relationship_protocols rows only (that
    # association table's ondelete="CASCADE") — the
    # attached Protocol rows themselves are NOT deleted,
    # since they may still be attached to other
    # relationships. A relationship delete never
    # surprise-deletes protocol data.
    await db.delete(rel)
    await db.commit()
