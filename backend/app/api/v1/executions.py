from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import Execution
from app.schemas.execution import ExecuteRequest, ExecutionRead, RoutingEventRead, ValidationResult
from app.services.execution_service import execute_graph, get_execution, validate_graph

router = APIRouter(tags=["Executions"])


@router.post("/graphs/{graph_id}/validate", response_model=ValidationResult)
async def validate(graph_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await validate_graph(db, graph_id)
    except Exception as e:
        raise HTTPException(404, str(e))
    return result


@router.post("/graphs/{graph_id}/execute", response_model=ExecutionRead, status_code=201)
async def execute(graph_id: str, data: ExecuteRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await execute_graph(db, graph_id, data.start_node_id, data.question)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/executions/{execution_id}", response_model=ExecutionRead)
async def get_one(execution_id: str, db: AsyncSession = Depends(get_db)):
    execution = await get_execution(db, execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    return execution


@router.get("/executions/{execution_id}/trace", response_model=list[RoutingEventRead])
async def trace(execution_id: str, db: AsyncSession = Depends(get_db)):
    execution = await get_execution(db, execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    return execution.routing_events


@router.post("/executions/{execution_id}/stop", response_model=ExecutionRead)
async def stop(execution_id: str, db: AsyncSession = Depends(get_db)):
    execution = await get_execution(db, execution_id)
    if not execution:
        raise HTTPException(404, "Execution not found")
    execution.status = "STOPPED"
    await db.commit()
    await db.refresh(execution)
    return execution
