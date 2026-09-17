from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import Relationship
from app.schemas.protocol import ProtocolCreate, ProtocolRead
from app.schemas.relationship import RelationshipCreate, RelationshipRead, RelationshipUpdate
from app.services import protocol_service
from app.services.relationship_service import (
    create_relationship,
    delete_relationship,
    list_relationships,
    to_relationship_read,
    update_relationship,
)

router = APIRouter(tags=["Relationships"])


@router.post("/graphs/{graph_id}/relationships", response_model=RelationshipRead, status_code=201)
async def create(graph_id: str, data: RelationshipCreate, db: AsyncSession = Depends(get_db)):
    try:
        rel = await create_relationship(db, graph_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return to_relationship_read(rel)


@router.get("/graphs/{graph_id}/relationships", response_model=list[RelationshipRead])
async def list_all(graph_id: str, db: AsyncSession = Depends(get_db)):
    rels = await list_relationships(db, graph_id)
    return [to_relationship_read(r) for r in rels]


@router.put("/relationships/{relationship_id}", response_model=RelationshipRead)
async def update(relationship_id: str, data: RelationshipUpdate, db: AsyncSession = Depends(get_db)):
    rel = await db.get(Relationship, relationship_id)
    if not rel:
        raise HTTPException(404, "Relationship not found")
    rel = await update_relationship(db, rel, data)
    return to_relationship_read(rel)


@router.delete("/relationships/{relationship_id}", status_code=204)
async def delete(relationship_id: str, db: AsyncSession = Depends(get_db)):
    rel = await db.get(Relationship, relationship_id)
    if not rel:
        raise HTTPException(404, "Relationship not found")
    await delete_relationship(db, rel)


# =====================================================
# Relationship <-> Protocol association
#
# Protocols are the rules governing communication over a
# specific relationship. A relationship can have zero or
# more; these four endpoints are the only way a protocol
# is created, listed-by-relationship, reused, or removed
# from one.
# =====================================================

@router.get("/relationships/{relationship_id}/protocols", response_model=list[ProtocolRead])
async def list_protocols_for_relationship(relationship_id: str, db: AsyncSession = Depends(get_db)):
    try:
        protocols = await protocol_service.list_relationship_protocols(db, relationship_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return [protocol_service.to_protocol_read(p) for p in protocols]


@router.post("/relationships/{relationship_id}/protocols", response_model=ProtocolRead, status_code=201)
async def create_protocol_for_relationship(
    relationship_id: str, data: ProtocolCreate, db: AsyncSession = Depends(get_db)
):
    try:
        protocol = await protocol_service.create_relationship_protocol(db, relationship_id, data)
    except LookupError as e:
        raise HTTPException(404, str(e))
    return protocol_service.to_protocol_read(protocol)


@router.post("/relationships/{relationship_id}/protocols/{protocol_id}/attach", response_model=ProtocolRead)
async def attach_protocol_to_relationship(
    relationship_id: str, protocol_id: str, db: AsyncSession = Depends(get_db)
):
    try:
        protocol = await protocol_service.attach_protocol(db, relationship_id, protocol_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(409, str(e))
    return protocol_service.to_protocol_read(protocol)


@router.delete("/relationships/{relationship_id}/protocols/{protocol_id}", status_code=204)
async def detach_protocol_from_relationship(
    relationship_id: str, protocol_id: str, db: AsyncSession = Depends(get_db)
):
    try:
        await protocol_service.detach_protocol(db, relationship_id, protocol_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
