from datetime import datetime
from enum import Enum
from pydantic import BaseModel


class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


class ExecuteRequest(BaseModel):
    start_node_id: str
    question: str


class AgentResponseRead(BaseModel):
    node_id: str
    status: str
    response: str
    metadata: dict = {}


class RoutingEventRead(BaseModel):
    from_node: str
    to_node: str
    reason: str
    relationship_id: str | None = None
    protocol_id: str | None = None
    allowed: bool
    timestamp: datetime


class ExecutionRead(BaseModel):
    id: str
    graph_id: str
    question: str
    start_node_id: str
    status: ExecutionStatus
    active_nodes: list[str]
    pending_nodes: list[str]
    completed_nodes: list[str]
    failed_nodes: list[str]
    responses: list[dict]
    routing_events: list[dict]
    created_at: datetime
    completed_at: datetime | None


class ValidationResult(BaseModel):
    valid: bool
    errors: list[str]
    warnings: list[str]
