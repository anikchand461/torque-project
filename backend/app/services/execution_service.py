from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.mock_agent import MockPersonaAgent
from app.graph_engine.engine import GraphExecutionEngine
from app.models import Execution, Graph, Node, Protocol, Relationship
from app.graph_engine.validator import GraphValidator


async def execute_graph(db: AsyncSession, graph_id: str, start_node_id: str, question: str) -> Execution:
    return await GraphExecutionEngine(db).execute(graph_id, start_node_id, question, MockPersonaAgent())


async def get_execution(db: AsyncSession, execution_id: str) -> Execution | None:
    return await db.get(Execution, execution_id)


async def list_executions(db: AsyncSession, graph_id: str) -> list[Execution]:
    # Most recent first — matches the order the frontend already
    # prepends newly-run executions in, so a page reload doesn't
    # visibly reorder the list the user was just looking at.
    return list(
        (
            await db.scalars(
                select(Execution).where(Execution.graph_id == graph_id).order_by(Execution.created_at.desc())
            )
        ).all()
    )


async def validate_graph(db: AsyncSession, graph_id: str):
    nodes = list((await db.scalars(select(Node).where(Node.graph_id == graph_id))).all())
    relationships = list(
        (
            await db.scalars(
                select(Relationship)
                .where(Relationship.graph_id == graph_id)
                .options(selectinload(Relationship.protocols))
            )
        ).all()
    )
    protocols = list((await db.scalars(select(Protocol).where(Protocol.graph_id == graph_id))).all())
    return GraphValidator().validate(nodes, relationships, protocols)
