from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class Direction(str, Enum):
    FORWARD = "FORWARD"
    REVERSE = "REVERSE"
    BIDIRECTIONAL = "BIDIRECTIONAL"


class RelationshipBase(BaseModel):
    source_node_id: str
    target_node_id: str
    relationship_type: str = Field(min_length=1, max_length=100)
    direction: Direction
    context: dict | None = None
    reliance: dict | None = None
    protocol_id: str | None = None


class RelationshipCreate(RelationshipBase):
    pass


class RelationshipUpdate(BaseModel):
    relationship_type: str | None = Field(default=None, min_length=1, max_length=100)
    direction: Direction | None = None
    context: dict | None = None
    reliance: dict | None = None
    protocol_id: str | None = None


class RelationshipRead(RelationshipBase):
    id: str
    graph_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
