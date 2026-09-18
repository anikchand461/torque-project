from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


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
    # The ORM column is `Execution.id` (like every other model), but
    # this is serialized as `execution_id` because that's the field
    # name the frontend's Execution type has always used. Without
    # this alias the JSON key was plain "id", so every
    # `execution.execution_id` read on the frontend silently came
    # back `undefined` — which broke a lot more than it looked like:
    # the Executions list's `key={execution.execution_id}` collided
    # across every row, and worse, the "add this execution" reducer
    # (`current.filter((item) => item.execution_id !== execution.execution_id)`)
    # matched `undefined !== undefined` as false for every existing
    # entry and filtered them all out, so only the most recently run
    # execution ever survived in state — the exact "only the last
    # execution shows" symptom.
    execution_id: str = Field(validation_alias="id")
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
