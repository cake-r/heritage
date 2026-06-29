"""AI 智能伴游 API"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.companion import (
    CompanionSuggestion, CompanionSuggestRequest, CompanionContext,
)
from app.services.ai.companion import (
    generate_suggestions, get_companion_context,
)

logger = logging.getLogger("companion_api")

router = APIRouter()


@router.post("/suggest", response_model=list[CompanionSuggestion])
def suggest(
    req: CompanionSuggestRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """根据当前页面 + 用户上下文生成 1-3 条伴游建议"""
    suggestions = generate_suggestions(
        current_user.id, req.page, req.context_hint, db
    )
    return [CompanionSuggestion(**s) for s in suggestions]


@router.get("/context", response_model=CompanionContext)
def get_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户跨模块行为摘要"""
    ctx = get_companion_context(current_user.id, db)
    return CompanionContext(**ctx)
