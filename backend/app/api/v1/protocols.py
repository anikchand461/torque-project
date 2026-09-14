from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import Graph, Protocol
from app.schemas.protocol import ProtocolCreate, ProtocolRead, ProtocolUpdate

router = APIRouter(tags=["Protocols"])


@router.post("/graphs/{graph_id}/protocols", response_model=ProtocolRead, status_code=201)
async def create_protocol(graph_id: str, data: ProtocolCreate, db: AsyncSession = Depends(get_db)):
    if not await db.get(Graph, graph_id):
        raise HTTPException(404, "Graph not found")
    protocol = Protocol(graph_id=graph_id, metadata_=data.metadata, **data.model_dump(exclude={"metadata"}))
    db.add(protocol)
    await db.commit()
    await db.refresh(protocol)
    return protocol


@router.get("/graphs/{graph_id}/protocols", response_model=list[ProtocolRead])
async def list_protocols(graph_id: str, db: AsyncSession = Depends(get_db)):
    if not await db.get(Graph, graph_id):
        raise HTTPException(404, "Graph not found")
    return list((await db.scalars(select(Protocol).where(Protocol.graph_id == graph_id))).all())


@router.put("/protocols/{protocol_id}", response_model=ProtocolRead)
async def update_protocol(protocol_id: str, data: ProtocolUpdate, db: AsyncSession = Depends(get_db)):
    protocol = await db.get(Protocol, protocol_id)
    if not protocol:
        raise HTTPException(404, "Protocol not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(protocol, "metadata_" if key == "metadata" else key, value)
    await db.commit()
    await db.refresh(protocol)
    return protocol


@router.delete("/protocols/{protocol_id}", status_code=204)
async def delete_protocol(protocol_id: str, db: AsyncSession = Depends(get_db)):
    protocol = await db.get(Protocol, protocol_id)
    if not protocol:
        raise HTTPException(404, "Protocol not found")
    await db.delete(protocol)
    await db.commit()
