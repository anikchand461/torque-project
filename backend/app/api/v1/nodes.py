from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import Graph, Node
from app.schemas.node import NodeCreate, NodeRead, NodeUpdate

router = APIRouter(tags=["Nodes"])


@router.post("/graphs/{graph_id}/nodes", response_model=NodeRead, status_code=201)
async def create_node(graph_id: str, data: NodeCreate, db: AsyncSession = Depends(get_db)):
    graph = await db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(404, "Graph not found")
    if data.parent_id:
        parent = await db.get(Node, data.parent_id)
        if not parent or parent.graph_id != graph_id:
            raise HTTPException(400, "Parent node must belong to the graph")
    node = Node(graph_id=graph_id, metadata_=data.metadata, **data.model_dump(exclude={"metadata"}))
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.get("/graphs/{graph_id}/nodes", response_model=list[NodeRead])
async def list_nodes(graph_id: str, db: AsyncSession = Depends(get_db)):
    if not await db.get(Graph, graph_id):
        raise HTTPException(404, "Graph not found")
    return list((await db.scalars(select(Node).where(Node.graph_id == graph_id))).all())


@router.get("/nodes/{node_id}", response_model=NodeRead)
async def get_node(node_id: str, db: AsyncSession = Depends(get_db)):
    node = await db.get(Node, node_id)
    if not node:
        raise HTTPException(404, "Node not found")
    return node


@router.put("/nodes/{node_id}", response_model=NodeRead)
async def update_node(node_id: str, data: NodeUpdate, db: AsyncSession = Depends(get_db)):
    node = await db.get(Node, node_id)
    if not node:
        raise HTTPException(404, "Node not found")
    if data.parent_id:
        parent = await db.get(Node, data.parent_id)
        if not parent or parent.graph_id != node.graph_id or data.parent_id == node_id:
            raise HTTPException(400, "Invalid parent node")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(node, "metadata_" if key == "metadata" else key, value)
    await db.commit()
    await db.refresh(node)
    return node


@router.delete("/nodes/{node_id}", status_code=204)
async def delete_node(node_id: str, db: AsyncSession = Depends(get_db)):
    node = await db.get(Node, node_id)
    if not node:
        raise HTTPException(404, "Node not found")
    await db.delete(node)
    await db.commit()
