from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.graph import GraphCreate, GraphRead, GraphUpdate
from app.services.graph_service import create_graph, delete_graph, get_graph, list_graphs, update_graph

router = APIRouter(prefix="/graphs", tags=["Graphs"])


@router.post("", response_model=GraphRead, status_code=201)
async def create(data: GraphCreate, db: AsyncSession = Depends(get_db)):
    return await create_graph(db, data)


@router.get("", response_model=list[GraphRead])
async def list_all(db: AsyncSession = Depends(get_db)):
    return await list_graphs(db)


@router.get("/{graph_id}", response_model=GraphRead)
async def get_one(graph_id: str, db: AsyncSession = Depends(get_db)):
    graph = await get_graph(db, graph_id)
    if not graph:
        raise HTTPException(404, "Graph not found")
    return graph


@router.put("/{graph_id}", response_model=GraphRead)
async def update(graph_id: str, data: GraphUpdate, db: AsyncSession = Depends(get_db)):
    graph = await get_graph(db, graph_id)
    if not graph:
        raise HTTPException(404, "Graph not found")
    return await update_graph(db, graph, data)


@router.delete("/{graph_id}", status_code=204)
async def delete(graph_id: str, db: AsyncSession = Depends(get_db)):
    graph = await get_graph(db, graph_id)
    if not graph:
        raise HTTPException(404, "Graph not found")
    await delete_graph(db, graph)
