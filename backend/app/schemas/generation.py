"""文创生成 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel, Field


class TextToImageRequest(BaseModel):
    base_style: str = Field(..., min_length=1, max_length=50)
    elements: list[str] = Field(default_factory=list, max_length=8)
    color_palette: str = Field(default="")
    composition: str = Field(default="")
    intensity: float = Field(default=0.7, ge=0.0, le=1.0)
    negative_prompt: str = Field(default="", max_length=500)
    count: int = Field(default=2, ge=1, le=4)


class GenerationResponse(BaseModel):
    id: int
    images: list[str]
    params: dict
    seed: int | None = None
    prompt_used: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerationListItem(BaseModel):
    id: int
    images: list[str]
    base_style: str
    prompt: str
    is_public: bool
    created_at: datetime
    mode: str = ""
    user_id: int | None = None
    username: str = ""

    model_config = {"from_attributes": True}


class PublishRequest(BaseModel):
    is_public: bool = True
