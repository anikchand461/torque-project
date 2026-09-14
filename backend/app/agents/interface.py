from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class AgentRequest:
    execution_id: str
    node_id: str
    task: str
    context: dict[str, Any] = field(default_factory=dict)
    persona_details: dict[str, Any] = field(default_factory=dict)
    previous_responses: list[dict[str, Any]] = field(default_factory=list)
    applicable_protocols: list[dict[str, Any]] = field(default_factory=list)


@dataclass(slots=True)
class AgentResponse:
    node_id: str
    status: str
    response: str
    metadata: dict[str, Any] = field(default_factory=dict)


class PersonaAgent(ABC):
    @abstractmethod
    async def execute(self, request: AgentRequest) -> AgentResponse:
        raise NotImplementedError
