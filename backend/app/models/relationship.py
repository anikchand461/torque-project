from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String, Table, UniqueConstraint
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

    __table_args__ = (
        # Backs "only one communication relationship between any two
        # nodes, regardless of direction" (A -> B and B -> A count as
        # the same pair) with an actual DB guarantee, not just the
        # check-then-insert in relationship_service.py — that check is
        # racy under two concurrent creates for the same pair, since
        # both can pass the SELECT before either COMMITs. node_pair_key
        # is source/target sorted into a stable order (see
        # relationship_service._node_pair_key), so the same pair always
        # produces the same key regardless of which node was picked as
        # "source" when the relationship was drawn.
        UniqueConstraint("graph_id", "node_pair_key", name="uq_relationship_node_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    graph_id: Mapped[str] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)
    direction: Mapped[RelationshipDirection] = mapped_column(String(20), nullable=False)
    context: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reliance: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Set once at creation from (source_node_id, target_node_id) sorted
    # into a stable order — never updated afterwards, since neither
    # endpoint nor schema allows changing source/target on an existing
    # relationship. See the UniqueConstraint above.
    node_pair_key: Mapped[str] = mapped_column(String(73), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    graph = relationship("Graph", back_populates="relationships")
    protocols: Mapped[list["Protocol"]] = relationship(
        "Protocol", secondary=relationship_protocols, back_populates="relationships"
    )

