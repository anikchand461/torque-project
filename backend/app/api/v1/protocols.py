from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models import Graph, Protocol
from app.schemas.protocol import ProtocolRead, ProtocolUpdate
from app.services import protocol_service

router = APIRouter(tags=["Protocols"])


# Protocols are no longer created independent of a
# relationship — POST /graphs/{graph_id}/protocols has been
# removed. Create (and attach) a protocol via
# POST /relationships/{relationship_id}/protocols instead
# (see api/v1/relationships.py). This is a read-only
# overview of every protocol currently in use in the graph,
# grouped by relationship on the frontend.
@router.get("/graphs/{graph_id}/protocols", response_model=list[ProtocolRead])
async def list_protocols(graph_id: str, db: AsyncSession = Depends(get_db)):
    if not await db.get(Graph, graph_id):
        raise HTTPException(404, "Graph not found")
    protocols = await protocol_service.list_graph_protocols(db, graph_id)
    return [protocol_service.to_protocol_read(p) for p in protocols]


@router.put("/protocols/{protocol_id}", response_model=ProtocolRead)
async def update_protocol(protocol_id: str, data: ProtocolUpdate, db: AsyncSession = Depends(get_db)):
    protocol = await db.get(
        Protocol, protocol_id, options=[selectinload(Protocol.relationships)]
    )
    if not protocol:
        raise HTTPException(404, "Protocol not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(protocol, "metadata_" if key == "metadata" else key, value)
    await db.commit()
    await db.refresh(protocol, attribute_names=["relationships"])
    return protocol_service.to_protocol_read(protocol)


@router.delete("/protocols/{protocol_id}", status_code=204)
async def delete_protocol(protocol_id: str, db: AsyncSession = Depends(get_db)):
    protocol = await db.get(Protocol, protocol_id)
    if not protocol:
        raise HTTPException(404, "Protocol not found")
    # Cascades to relationship_protocols rows only, via that
    # association table's ondelete="CASCADE" — every
    # relationship this protocol was attached to simply
    # loses this one attachment.
    await db.delete(protocol)
    await db.commit()
