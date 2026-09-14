from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class GraphBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    target_organization: str | None = None


class GraphCreate(GraphBase):
    pass


class GraphUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    target_organization: str | None = None


class GraphRead(GraphBase):
    id: str
    version: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
