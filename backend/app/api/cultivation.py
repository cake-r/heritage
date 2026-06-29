"""非遗修习之路 API"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.cultivation import (
    CultivationStatus, DailyQuest, WeeklyChallenge, QuestCompleteResponse,
)
from app.schemas.common import MessageResponse
from app.services.cultivation_service import (
    get_cultivation_status as get_status,
    get_or_create_daily_quests,
    complete_quest as do_complete_quest,
    get_weekly_challenge as get_weekly,
)
from app.utils.exceptions import AppException

logger = logging.getLogger("cultivation_api")

router = APIRouter()


@router.get("/status", response_model=CultivationStatus)
def get_cultivation_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户修习状态 — 段位、XP、6条技能树进度"""
    status = get_status(current_user.id, db)
    return CultivationStatus(**status)


@router.get("/quests", response_model=list[DailyQuest])
def get_quests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取今日任务列表（首次访问自动生成）"""
    quests = get_or_create_daily_quests(current_user.id, db)
    return [DailyQuest(**q) for q in quests]


@router.post("/quests/{quest_id}/complete", response_model=QuestCompleteResponse)
def complete_quest(
    quest_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """完成每日任务 — 获取 XP 奖励"""
    try:
        result = do_complete_quest(current_user.id, quest_id, db)
        return QuestCompleteResponse(**result)
    except ValueError as e:
        raise AppException(str(e), code=400)


@router.get("/weekly-challenge", response_model=WeeklyChallenge)
def get_weekly_challenge(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取本周挑战"""
    challenge = get_weekly(current_user.id, db)
    return WeeklyChallenge(**challenge)
