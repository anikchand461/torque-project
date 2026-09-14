from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Graph
from app.schemas.graph import GraphCreate, GraphUpdate


async def create_graph(db: AsyncSession, data: GraphCreate) -> Graph:
    graph = Graph(**data.model_dump())
    db.add(graph)
    await db.commit()
    await db.refresh(graph)
    return graph


async def list_graphs(db: AsyncSession) -> list[Graph]:
    return list((await db.scalars(select(Graph).order_by(Graph.created_at.desc()))).all())


async def get_graph(db: AsyncSession, graph_id: str) -> Graph | None:
    return await db.get(Graph, graph_id)


async def update_graph(db: AsyncSession, graph: Graph, data: GraphUpdate) -> Graph:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(graph, key, value)
    graph.version += 1
    await db.commit()
    await db.refresh(graph)
    return graph


async def delete_graph(db: AsyncSession, graph: Graph) -> None:
    await db.delete(graph)
    await db.commit()
