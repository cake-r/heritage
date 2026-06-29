"""千人千面推荐引擎 API"""

import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.api.deps import get_current_user, get_optional_user
from app.schemas.recommendation import (
    RecommendationFeed, RecommendationItem, ModuleRecommendations, ProfileUpdateRequest,
)
from app.schemas.common import MessageResponse
from app.services.ai.recommendation import (
    generate_feed, get_module_recommendations, trigger_profile_update,
)

logger = logging.getLogger("recommendation_api")

router = APIRouter()


@router.post("/update-profile", response_model=MessageResponse)
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    """更新用户兴趣画像 (fire-and-forget) — 用户操作后调用"""
    trigger_profile_update(current_user.id, req.action_type, req.action_data)
    return MessageResponse(message="画像更新已提交")


@router.get("/feed", response_model=RecommendationFeed)
def get_feed(
    page: int = Query(1, ge=1),
    size: int = Query(8, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取个性化推荐流 — 首页动态推荐"""
    result = generate_feed(current_user.id, page, size, db)
    return RecommendationFeed(**result)


@router.get("/for-module", response_model=ModuleRecommendations)
def get_for_module(
    module: str = Query(..., description="exhibition | workshop | knowledge-graph"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取模块级个性化推荐"""
    result = get_module_recommendations(current_user.id, module, db)
    return ModuleRecommendations(**result)
