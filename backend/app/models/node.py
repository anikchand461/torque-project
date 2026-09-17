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

    # post_update=True is the standard SQLAlchemy fix for a
    # self-referential relationship (see "Rows that point to
    # themselves / Mutually Dependent Rows" in the SQLAlchemy docs):
    # it makes the ORM synchronize parent_id via a separate UPDATE
    # issued after the main INSERT/DELETE statements, instead of
    # using this relationship to decide insert/delete order. That
    # matters here because nothing in the app stops a node's parent
    # from being reassigned into a cycle (e.g. editing A's parent to
    # B after B's parent is already A — both directions go through
    # the same plain parent_id update, with no cycle check) — and a
    # genuine two-node mutual-parent cycle can never be linearized by
    # a topological sort no matter what, which is what was still
    # raising CircularDependencyError on delete even after
    # passive_deletes alone (below) fixed the plain-tree case.
    parent = relationship(
        "Node",
        remote_side=[id],
        back_populates="children",
        post_update=True,
    )

    # passive_deletes=True defers to the DB's ON DELETE SET NULL
    # (declared on parent_id above, and enforced for SQLite via the
    # PRAGMA foreign_keys=ON connect hook in core/database.py) instead
    # of having the ORM load and null out every child row itself.
    children = relationship(
        "Node", back_populates="parent", passive_deletes=True
    )
