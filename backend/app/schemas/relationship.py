from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.protocol import ProtocolRead


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
    # protocol_id REMOVED — a relationship can have zero
    # or more protocols now, attached after the
    # relationship exists via the dedicated
    # /relationships/{id}/protocols endpoints, not set at
    # creation/update time.


class RelationshipCreate(RelationshipBase):
    pass


class RelationshipUpdate(BaseModel):
    relationship_type: str | None = Field(default=None, min_length=1, max_length=100)
    direction: Direction | None = None
    context: dict | None = None
    reliance: dict | None = None


class RelationshipRead(RelationshipBase):
    id: str
    graph_id: str
    created_at: datetime

    # Populated explicitly by the service layer from the
    # eager-loaded `.protocols` ORM collection (see
    # relationship_service.py) — full protocol details
    # plus the lightweight id list, so the frontend never
    # needs a second round-trip just to show what's
    # already attached.
    protocol_ids: list[str] = []
    protocols: list[ProtocolRead] = []

    model_config = ConfigDict(from_attributes=True)
