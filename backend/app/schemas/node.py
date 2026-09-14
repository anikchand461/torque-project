from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NodeBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    title: str | None = None
    role: str | None = None
    responsibilities: list[str] | None = None
    decision_rights: list[str] | None = None
    persona_details: dict | None = None
    metadata: dict | None = None
    parent_id: str | None = None


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    title: str | None = None
    role: str | None = None
    responsibilities: list[str] | None = None
    decision_rights: list[str] | None = None
    persona_details: dict | None = None
    metadata: dict | None = None
    parent_id: str | None = None


class NodeRead(NodeBase):
    id: str
    graph_id: str
    created_at: datetime
    updated_at: datetime

    # SQLAlchemy attribute is metadata_,
    # but the API should expose it as metadata.
    metadata: dict | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )