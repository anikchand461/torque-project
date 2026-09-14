from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Graph(Base):
    __tablename__ = "graphs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_organization: Mapped[str | None] = mapped_column(String(200), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    nodes = relationship("Node", back_populates="graph", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="graph", cascade="all, delete-orphan")
    protocols = relationship("Protocol", back_populates="graph", cascade="all, delete-orphan")
    executions = relationship("Execution", back_populates="graph", cascade="all, delete-orphan")
