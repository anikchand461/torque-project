from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProtocolBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    can_send: bool = True
    can_receive: bool = True
    can_escalate: bool = False
    can_bypass: bool = False
    can_forward: bool = False
    confidentiality: str | None = None
    allowed_information_types: list[str] | None = None
    conditions: list[dict] | None = None
    allowed_targets: list[str] | None = None
    stop_conditions: list[dict] | None = None
    metadata: dict | None = None


class ProtocolCreate(ProtocolBase):
    pass


class ProtocolUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    can_send: bool | None = None
    can_receive: bool | None = None
    can_escalate: bool | None = None
    can_bypass: bool | None = None
    can_forward: bool | None = None
    confidentiality: str | None = None
    allowed_information_types: list[str] | None = None
    conditions: list[dict] | None = None
    allowed_targets: list[str] | None = None
    stop_conditions: list[dict] | None = None
    metadata: dict | None = None


class ProtocolRead(ProtocolBase):
    id: str
    graph_id: str
    created_at: datetime
    updated_at: datetime

    # Every relationship this protocol is currently
    # attached to. Populated explicitly by the
    # router/service layer from the loaded ORM
    # `.relationships` collection (not derived
    # automatically from an identically-named attribute,
    # since that collection holds full Relationship
    # objects, not ids, and embedding full relationships
    # back here would risk a circular payload —
    # RelationshipRead already embeds Protocol below).
    relationship_ids: list[str] = []

    metadata: dict | None = Field(
        default=None,
        validation_alias="metadata_",
        serialization_alias="metadata",
    )

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )