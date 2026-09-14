from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Protocol(Base):
    __tablename__ = "protocols"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    graph_id: Mapped[str] = mapped_column(ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    can_send: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_receive: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_escalate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_bypass: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    can_forward: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidentiality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    allowed_information_types: Mapped[list | None] = mapped_column(JSON, nullable=True)
    conditions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    allowed_targets: Mapped[list | None] = mapped_column(JSON, nullable=True)
    stop_conditions: Mapped[list | None] = mapped_column(JSON, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    graph = relationship("Graph", back_populates="protocols")
    relationships = relationship("Relationship", back_populates="protocol")
