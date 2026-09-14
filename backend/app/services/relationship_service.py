from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Node, Protocol, Relationship
from app.schemas.relationship import RelationshipCreate, RelationshipUpdate


async def create_relationship(db: AsyncSession, graph_id: str, data: RelationshipCreate) -> Relationship:
    for node_id in (data.source_node_id, data.target_node_id):
        node = await db.get(Node, node_id)
        if node is None or node.graph_id != graph_id:
            raise ValueError("Both relationship nodes must belong to the graph.")
    if data.protocol_id:
        protocol = await db.get(Protocol, data.protocol_id)
        if protocol is None or protocol.graph_id != graph_id:
            raise ValueError("Protocol must belong to the graph.")
    rel = Relationship(graph_id=graph_id, **data.model_dump())
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return rel


async def list_relationships(db: AsyncSession, graph_id: str) -> list[Relationship]:
    return list((await db.scalars(select(Relationship).where(Relationship.graph_id == graph_id))).all())


async def update_relationship(db: AsyncSession, rel: Relationship, data: RelationshipUpdate) -> Relationship:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rel, key, value)
    await db.commit()
    await db.refresh(rel)
    return rel


async def delete_relationship(db: AsyncSession, rel: Relationship) -> None:
    await db.delete(rel)
    await db.commit()
