from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RelationshipDirection(str, Enum):
    FORWARD = "FORWARD"
    REVERSE = "REVERSE"
    BIDIRECTIONAL = "BIDIRECTIONAL"


class Relationship(Base):
    __tablename__ = "relationships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    graph_id: Mapped[str] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)
    direction: Mapped[RelationshipDirection] = mapped_column(String(20), nullable=False)
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reliance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    protocol_id: Mapped[str | None] = mapped_column(ForeignKey("protocols.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    graph = relationship("Graph", back_populates="relationships")
    protocol = relationship("Protocol", back_populates="relationships")
