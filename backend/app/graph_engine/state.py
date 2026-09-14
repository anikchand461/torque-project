from dataclasses import dataclass, field
from typing import Any


@dataclass
class ExecutionState:
    execution_id: str
    graph_id: str
    question: str
    start_node_id: str
    active_nodes: set[str] = field(default_factory=set)
    pending_nodes: set[str] = field(default_factory=set)
    completed_nodes: set[str] = field(default_factory=set)
    failed_nodes: set[str] = field(default_factory=set)
    responses: list[dict[str, Any]] = field(default_factory=list)
    routing_events: list[dict[str, Any]] = field(default_factory=list)
    stopped: bool = False
