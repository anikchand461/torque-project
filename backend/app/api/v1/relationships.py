from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import Relationship
from app.schemas.relationship import RelationshipCreate, RelationshipRead, RelationshipUpdate
from app.services.relationship_service import create_relationship, delete_relationship, list_relationships, update_relationship

router = APIRouter(tags=["Relationships"])


@router.post("/graphs/{graph_id}/relationships", response_model=RelationshipRead, status_code=201)
async def create(graph_id: str, data: RelationshipCreate, db: AsyncSession = Depends(get_db)):
    try:
        return await create_relationship(db, graph_id, data)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/graphs/{graph_id}/relationships", response_model=list[RelationshipRead])
async def list_all(graph_id: str, db: AsyncSession = Depends(get_db)):
    return await list_relationships(db, graph_id)


@router.put("/relationships/{relationship_id}", response_model=RelationshipRead)
async def update(relationship_id: str, data: RelationshipUpdate, db: AsyncSession = Depends(get_db)):
    rel = await db.get(Relationship, relationship_id)
    if not rel:
        raise HTTPException(404, "Relationship not found")
    return await update_relationship(db, rel, data)


@router.delete("/relationships/{relationship_id}", status_code=204)
async def delete(relationship_id: str, db: AsyncSession = Depends(get_db)):
    rel = await db.get(Relationship, relationship_id)
    if not rel:
        raise HTTPException(404, "Relationship not found")
    await delete_relationship(db, rel)
