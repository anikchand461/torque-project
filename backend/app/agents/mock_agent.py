from app.agents.interface import AgentRequest, AgentResponse, PersonaAgent


class MockPersonaAgent(PersonaAgent):
    async def execute(self, request: AgentRequest) -> AgentResponse:
        node_name = request.context.get("node_name", request.node_id)
        return AgentResponse(
            node_id=request.node_id,
            status="COMPLETED",
            response=f"[MOCK] {node_name} received task: {request.task}",
            metadata={"agent": "mock", "deterministic": True},
        )
