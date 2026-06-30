"""AI 智能伴游 Pydantic Schemas"""

from pydantic import BaseModel, Field
from typing import Optional


class CompanionSuggestion(BaseModel):
    """单条伴游建议"""
    id: str
    title: str
    description: str
    target_route: str       # e.g. /exhibition?id=42
    icon: str               # emoji
    confidence: float       # 0.0-1.0, <0.6 不展示
    category: str           # progression | discovery | quest | related


class CompanionSuggestRequest(BaseModel):
    """建议请求"""
    page: str               # 当前页面路由 e.g. "/recognition"
    context_hint: Optional[str] = None


class CompanionContext(BaseModel):
    """用户跨模块行为摘要"""
    user_summary: str
    recent_activity: list[str]
    pending_quests: int
    recommended_modules: list[str]


# === 对话式伴游 ===

class CompanionChatRequest(BaseModel):
    """伴游对话请求"""
    message: str = Field(..., min_length=1, max_length=1000)
    page: str = "/"                                    # 当前页面
    history: list[dict] = []                           # 最近对话 [{role, content}, ...]


class CompanionChatResponse(BaseModel):
    """伴游对话回复"""
    reply: str                                         # 文本回复
    suggestions: list[CompanionSuggestion] = []        # 附带建议（可选）


# === 反馈 ===

class CompanionFeedbackRequest(BaseModel):
    """建议反馈"""
    suggestion_id: str
    action: str  # clicked | dismissed
    page: str
