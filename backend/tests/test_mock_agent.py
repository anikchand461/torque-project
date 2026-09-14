import pytest
from app.agents.interface import AgentRequest
from app.agents.mock_agent import MockPersonaAgent


@pytest.mark.asyncio
async def test_mock_agent_is_deterministic():
    agent = MockPersonaAgent()
    request = AgentRequest(execution_id="e", node_id="n", task="hello", context={"node_name": "CEO"})
    response = await agent.execute(request)
    assert response.status == "COMPLETED"
    assert "CEO" in response.response
    assert "hello" in response.response
