from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExecutionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


class Execution(Base):
    __tablename__ = "executions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    graph_id: Mapped[str] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    start_node_id: Mapped[str] = mapped_column(String(36), nullable=False)
    status: Mapped[ExecutionStatus] = mapped_column(String(20), default=ExecutionStatus.PENDING, nullable=False)
    active_nodes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    pending_nodes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    completed_nodes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    failed_nodes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    responses: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    routing_events: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    graph = relationship("Graph", back_populates="executions")
