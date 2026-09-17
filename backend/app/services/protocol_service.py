from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Protocol, Relationship
from app.schemas.protocol import ProtocolCreate, ProtocolRead


def to_protocol_read(protocol: Protocol) -> ProtocolRead:
    """Builds a ProtocolRead with relationship_ids populated
    from the (already eager-loaded) `.relationships`
    collection. Callers must have loaded that collection
    first (selectinload/refresh) — this function does not
    touch the database itself, so it's safe to call from
    either async or sync contexts.
    """
    data = ProtocolRead.model_validate(protocol)
    data.relationship_ids = [r.id for r in protocol.relationships]
    return data


async def _get_relationship_or_404(db: AsyncSession, relationship_id: str) -> Relationship:
    rel = await db.get(
        Relationship,
        relationship_id,
        options=[
            selectinload(Relationship.protocols).selectinload(
                Protocol.relationships
            )
        ],
    )
    if rel is None:
        raise LookupError("Relationship not found.")
    return rel


async def _get_protocol_or_404(db: AsyncSession, protocol_id: str) -> Protocol:
    protocol = await db.get(
        Protocol,
        protocol_id,
        options=[selectinload(Protocol.relationships)],
    )
    if protocol is None:
        raise LookupError("Protocol not found.")
    return protocol


async def list_relationship_protocols(db: AsyncSession, relationship_id: str) -> list[Protocol]:
    rel = await _get_relationship_or_404(db, relationship_id)
    return rel.protocols


async def create_relationship_protocol(
    db: AsyncSession, relationship_id: str, data: ProtocolCreate
) -> Protocol:
    """Creates a brand-new protocol and attaches it to this
    relationship in one step — the primary creation path
    (the frontend's "+ Add Protocol" button). graph_id is
    inherited from the relationship, never user-supplied,
    so a protocol can never be created floating/unattached.
    """
    rel = await _get_relationship_or_404(db, relationship_id)

    protocol = Protocol(
        graph_id=rel.graph_id,
        metadata_=data.metadata,
        **data.model_dump(exclude={"metadata"}),
    )
    protocol.relationships.append(rel)

    db.add(protocol)
    await db.commit()
    await db.refresh(protocol, attribute_names=["relationships"])

    return protocol


async def attach_protocol(db: AsyncSession, relationship_id: str, protocol_id: str) -> Protocol:
    """Attaches an already-existing protocol (e.g. one
    created for another relationship in the same graph) to
    this relationship as well.
    """
    rel = await _get_relationship_or_404(db, relationship_id)
    protocol = await _get_protocol_or_404(db, protocol_id)

    if protocol.graph_id != rel.graph_id:
        raise ValueError("This protocol belongs to a different graph and cannot be attached here.")

    if rel in protocol.relationships:
        raise ValueError("This protocol is already attached to this relationship.")

    protocol.relationships.append(rel)
    await db.commit()
    await db.refresh(protocol, attribute_names=["relationships"])

    return protocol


async def detach_protocol(db: AsyncSession, relationship_id: str, protocol_id: str) -> None:
    """Detaches a protocol from this relationship without
    deleting the protocol itself — it may still be attached
    to other relationships. Use DELETE /protocols/{id} to
    remove a protocol entirely.
    """
    rel = await _get_relationship_or_404(db, relationship_id)
    protocol = await _get_protocol_or_404(db, protocol_id)

    if rel not in protocol.relationships:
        raise LookupError("This protocol is not attached to this relationship.")

    protocol.relationships.remove(rel)
    await db.commit()


async def list_graph_protocols(db: AsyncSession, graph_id: str) -> list[Protocol]:
    return list(
        (
            await db.scalars(
                select(Protocol)
                .where(Protocol.graph_id == graph_id)
                .options(selectinload(Protocol.relationships))
            )
        ).all()
    )
