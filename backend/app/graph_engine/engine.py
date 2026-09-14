import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.agents.interface import AgentRequest, PersonaAgent
from app.graph_engine.context import ContextBuilder
from app.graph_engine.router import GraphRouter
from app.graph_engine.state import ExecutionState
from app.graph_engine.validator import GraphValidator
from app.models import Execution, ExecutionStatus, Graph, Node, Protocol, Relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class GraphExecutionEngine:
    def __init__(self, db: AsyncSession, validator: GraphValidator | None = None, router: GraphRouter | None = None, context_builder: ContextBuilder | None = None):
        self.db = db
        self.validator = validator or GraphValidator()
        self.router = router or GraphRouter()
        self.context_builder = context_builder or ContextBuilder()

    async def execute(self, graph_id: str, start_node_id: str, question: str, agent_provider: PersonaAgent) -> Execution:
        graph = await self.db.get(Graph, graph_id)
        if graph is None:
            raise ValueError("Graph not found.")

        nodes = list((await self.db.scalars(select(Node).where(Node.graph_id == graph_id))).all())
        relationships = list((await self.db.scalars(select(Relationship).where(Relationship.graph_id == graph_id))).all())
        protocols = list((await self.db.scalars(select(Protocol).where(Protocol.graph_id == graph_id))).all())
        node_map = {n.id: n for n in nodes}
        protocol_map = {p.id: p for p in protocols}

        if start_node_id not in node_map:
            raise ValueError("Start node does not belong to this graph.")

        validation = self.validator.validate(nodes, relationships, protocols)
        if not validation.valid:
            raise ValueError("Graph validation failed: " + " | ".join(validation.errors))

        execution = Execution(
            graph_id=graph_id,
            question=question,
            start_node_id=start_node_id,
            status=ExecutionStatus.RUNNING,
            pending_nodes=[start_node_id],
        )
        self.db.add(execution)
        await self.db.flush()

        state = ExecutionState(execution.id, graph_id, question, start_node_id, pending_nodes={start_node_id})
        visited: set[str] = set()
        relationship_map: dict[str, list[Relationship]] = defaultdict(list)
        for rel in relationships:
            relationship_map[rel.source_node_id].append(rel)
            relationship_map[rel.target_node_id].append(rel)

        try:
            while state.pending_nodes and not state.stopped:
                current_batch = sorted(state.pending_nodes)
                state.pending_nodes.clear()
                state.active_nodes.update(current_batch)

                async def run_node(node_id: str):
                    node = node_map[node_id]
                    prior = list(state.responses)
                    rels = relationship_map[node_id]
                    context = self.context_builder.build(node, question, prior, rels, protocol_map)
                    request = AgentRequest(
                        execution_id=execution.id,
                        node_id=node.id,
                        task=question,
                        context=context,
                        persona_details=node.persona_details or {},
                        previous_responses=prior,
                        applicable_protocols=context["applicable_protocols"],
                    )
                    return await agent_provider.execute(request)

                responses = await asyncio.gather(*(run_node(nid) for nid in current_batch), return_exceptions=True)
                for node_id, result in zip(current_batch, responses):
                    state.active_nodes.discard(node_id)
                    if isinstance(result, Exception):
                        state.failed_nodes.add(node_id)
                        continue
                    state.completed_nodes.add(node_id)
                    state.responses.append({
                        "node_id": result.node_id,
                        "status": result.status,
                        "response": result.response,
                        "metadata": result.metadata,
                    })

                    for rel, target_id in self.router.get_candidates(node_id, relationships):
                        protocol = protocol_map.get(rel.protocol_id) if rel.protocol_id else None
                        decision = self.router.evaluate(node_id, target_id, rel, protocol)
                        event = {
                            "from_node": node_id,
                            "to_node": target_id,
                            "reason": decision.reason,
                            "relationship_id": decision.relationship_id,
                            "protocol_id": decision.protocol_id,
                            "allowed": decision.allowed,
                            "timestamp": decision.timestamp.isoformat(),
                        }
                        state.routing_events.append(event)
                        if decision.allowed and target_id not in visited and target_id not in state.completed_nodes and target_id not in state.active_nodes and target_id not in state.pending_nodes:
                            state.pending_nodes.add(target_id)

                    visited.add(node_id)

            execution.status = ExecutionStatus.STOPPED if state.stopped else (ExecutionStatus.FAILED if state.failed_nodes and not state.completed_nodes else ExecutionStatus.COMPLETED)
        except Exception:
            execution.status = ExecutionStatus.FAILED
            raise
        finally:
            execution.active_nodes = sorted(state.active_nodes)
            execution.pending_nodes = sorted(state.pending_nodes)
            execution.completed_nodes = sorted(state.completed_nodes)
            execution.failed_nodes = sorted(state.failed_nodes)
            execution.responses = state.responses
            execution.routing_events = state.routing_events
            execution.completed_at = utcnow()
            await self.db.commit()
            await self.db.refresh(execution)

        return execution
