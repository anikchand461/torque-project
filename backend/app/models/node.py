from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    graph_id: Mapped[str] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    role: Mapped[str | None] = mapped_column(String(200), nullable=True)
    responsibilities: Mapped[list | None] = mapped_column(JSON, nullable=True)
    decision_rights: Mapped[list | None] = mapped_column(JSON, nullable=True)
    persona_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    graph = relationship("Graph", back_populates="nodes")
    parent = relationship("Node", remote_side=[id], back_populates="children")
    children = relationship("Node", back_populates="parent")
