"""AI 智能伴游 API — v2 对话式 + 反馈"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.companion import (
    CompanionSuggestion, CompanionSuggestRequest, CompanionContext,
    CompanionChatRequest, CompanionChatResponse, CompanionFeedbackRequest,
)
from app.services.ai.companion import (
    generate_suggestions, get_companion_context,
    chat_companion, record_interaction,
)

logger = logging.getLogger("companion_api")

router = APIRouter()


@router.post("/suggest", response_model=list[CompanionSuggestion])
def suggest(
    req: CompanionSuggestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """根据当前页面 + 用户旅程生成 1-3 条伴游建议"""
    suggestions = generate_suggestions(
        current_user.id, req.page, req.context_hint, db
    )
    return [CompanionSuggestion(**s) for s in suggestions]


@router.post("/chat", response_model=CompanionChatResponse)
def companion_chat(
    req: CompanionChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """与 AI 伴游对话"""
    result = chat_companion(
        current_user.id, req.message, req.page, req.history, db
    )
    return CompanionChatResponse(
        reply=result["reply"],
        suggestions=[CompanionSuggestion(**s) for s in result.get("suggestions", [])],
    )


@router.post("/feedback")
def feedback(
    req: CompanionFeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录用户对建议的反馈 (点击/关闭)"""
    record_interaction(
        current_user.id, req.suggestion_id, req.action, req.page, db
    )
    return {"ok": True}


@router.get("/context", response_model=CompanionContext)
def get_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户跨模块行为摘要"""
    ctx = get_companion_context(current_user.id, db)
    return CompanionContext(**ctx)
