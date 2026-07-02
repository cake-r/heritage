"""识别讲解相关 Pydantic Schema"""

from datetime import datetime
from pydantic import BaseModel
from app.schemas.common import PaginatedResponse


class CategoryCandidate(BaseModel):
    category: str
    confidence: float


class Explanation(BaseModel):
    history: str
    technique: str
    inheritor: str
    meaning: str


class CreationLink(BaseModel):
    style: str
    label: str


class ExhibitLink(BaseModel):
    id: int
    name: str


class HeatmapFeature(BaseModel):
    name: str
    x: float  # 归一化 x 坐标 (0-1)
    y: float  # 归一化 y 坐标 (0-1)
    label: str = ""


class RelatedRecommendations(BaseModel):
    creations: list[CreationLink]
    exhibits: list[ExhibitLink]


class RecognitionResponse(BaseModel):
    id: int
    image_url: str
    category: str
    confidence: float
    top3: list[CategoryCandidate]
    features: list[str]
    explanation: Explanation
    heatmap_url: str | None = None
    heatmap_data: list[HeatmapFeature] = []
    voice_url: str | None = None
    pattern_names: list[str] = []
    related: RelatedRecommendations
    created_at: datetime

    model_config = {"from_attributes": True}


class RecognitionListItem(BaseModel):
    id: int
    image_url: str
    category: str
    confidence: float
    created_at: datetime

    model_config = {"from_attributes": True}
