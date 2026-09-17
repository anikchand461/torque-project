from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RelationshipDirection(str, Enum):
    FORWARD = "FORWARD"
    REVERSE = "REVERSE"
    BIDIRECTIONAL = "BIDIRECTIONAL"


# Association table for the Relationship <-> Protocol
# many-to-many. A relationship can have zero or more
# protocols; a protocol could in principle be attached to
# more than one relationship (the "attach an existing
# protocol" endpoint relies on this), even though today's
# UI usually creates a protocol already scoped to exactly
# one relationship. The composite primary key is what
# makes "no duplicate attachment" a database-level
# guarantee, not just an application-level check.
relationship_protocols = Table(
    "relationship_protocols",
    Base.metadata,
    Column("relationship_id", String(36), ForeignKey("relationships.id", ondelete="CASCADE"), primary_key=True),
    Column("protocol_id", String(36), ForeignKey("protocols.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), default=utcnow, nullable=False),
)


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    graph = relationship("Graph", back_populates="relationships")
    protocols: Mapped[list["Protocol"]] = relationship(
        "Protocol", secondary=relationship_protocols, back_populates="relationships"
    )

