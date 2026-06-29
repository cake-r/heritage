"""推荐引擎 Pydantic Schemas"""

from pydantic import BaseModel, Field
from typing import Optional


class RecommendationItem(BaseModel):
    """单条推荐"""
    id: int
    item_type: str           # heritage | user_upload | inheritor
    title: str
    image_url: str
    category: str
    region: Optional[str] = None
    reason: str              # LLM 生成的可解释推荐理由
    score: float             # 0.0-1.0 匹配度
    target_route: str        # 前端跳转路由, e.g. /exhibition?id=123


class RecommendationFeed(BaseModel):
    """个性化推荐流"""
    items: list[RecommendationItem]
    page: int
    size: int
    profile_status: str      # "cold_start" | "active"


class ProfileUpdateRequest(BaseModel):
    """画像更新请求 (fire-and-forget)"""
    action_type: str         # recognition | generation | chat | favorite | view | restoration
    action_data: dict = Field(default_factory=dict)  # {"category":"刺绣","technique":"平针绣","region":"江苏"}


class ModuleRecommendations(BaseModel):
    """模块级推荐结果"""
    module: str
    items: list[RecommendationItem]
