"""展厅相关 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel, Field


class TechniqueItem(BaseModel):
    name: str
    desc: str = ""


class InheritorItem(BaseModel):
    name: str
    title: str = ""
    desc: str = ""


class HeritageItemResponse(BaseModel):
    id: int
    name: str
    category: str
    region: str | None = None
    era: str | None = None
    description: str | None = None
    techniques: list[TechniqueItem] = []
    inheritors: list[InheritorItem] = []
    images: list[str] = []
    cultural_meaning: str | None = None
    is_favorited: bool = False
    item_type: str = "heritage"  # "heritage" | "user_upload"
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class UserUploadRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: str = Field(default="", max_length=50)
    region: str = Field(default="", max_length=100)
    era: str = Field(default="", max_length=100)
    techniques: str = Field(default="[]", description="JSON string: [{\"name\":\"...\",\"desc\":\"...\"}]")
    inheritors: str = Field(default="[]", description="JSON string: [{\"name\":\"...\",\"title\":\"...\"}]")
    cultural_meaning: str = Field(default="", max_length=2000)


class UserUploadResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    images: list[str]
    category: str | None = None
    region: str | None = None
    era: str | None = None
    techniques: list[TechniqueItem] = []
    inheritors: list[InheritorItem] = []
    cultural_meaning: str | None = None
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
