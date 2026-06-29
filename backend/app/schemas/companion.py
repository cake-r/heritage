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
    context_hint: Optional[str] = None  # 额外上下文 e.g. "just_completed_recognition"


class CompanionContext(BaseModel):
    """用户跨模块行为摘要"""
    user_summary: str              # 2-3 句用户画像摘要
    recent_activity: list[str]     # 最近3个操作 (人可读)
    pending_quests: int            # 待完成任务数
    recommended_modules: list[str] # 推荐访问的模块
