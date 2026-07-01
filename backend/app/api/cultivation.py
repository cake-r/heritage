"""非遗修习之路 API"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.cultivation import (
    CultivationStatus, DailyQuest, WeeklyChallenge, QuestCompleteResponse,
    StreakInfo, QuestCheckResponse,
)
from app.schemas.common import MessageResponse
from app.services.cultivation_service import (
    get_cultivation_status as get_status,
    get_or_create_daily_quests,
    complete_quest as do_complete_quest,
    get_weekly_challenge as get_weekly,
    check_and_auto_complete_quests as do_check_quests,
    update_streak as do_update_streak,
)
from app.utils.exceptions import AppException

logger = logging.getLogger("cultivation_api")

router = APIRouter()


@router.get("/status", response_model=CultivationStatus)
def get_cultivation_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户修习状态 — 段位、XP、6条技能树进度、连胜数据"""
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
    """手动完成每日任务（仅限不可追踪任务；可追踪任务须条件达成）"""
    try:
        result = do_complete_quest(current_user.id, quest_id, db)
        return QuestCompleteResponse(**result)
    except ValueError as e:
        raise AppException(str(e), code=400)


@router.post("/quests/check", response_model=QuestCheckResponse)
def check_quests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    触发任务自动结算 — 检查所有 pending 的可追踪任务，
    条件达成的自动完成并发放 XP（含连胜加成）。
    各页面在用户完成操作后调用此接口。
    """
    try:
        result = do_check_quests(current_user.id, db)
        return QuestCheckResponse(**result)
    except Exception as e:
        logger.exception("任务自动检查失败")
        raise AppException(str(e), code=500)


@router.get("/streak", response_model=StreakInfo)
def get_streak(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前连胜状态"""
    streak = do_update_streak(current_user.id, db)
    return StreakInfo(**streak)


@router.get("/weekly-challenge", response_model=WeeklyChallenge)
def get_weekly_challenge(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取本周挑战"""
    challenge = get_weekly(current_user.id, db)
    return WeeklyChallenge(**challenge)


@router.post("/xp/recalculate")
def recalculate_xp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    补偿接口：根据用户所有行为记录重新计算 XP + 段位。
    前端检测到奖励未到账时可手动触发。
    """
    from app.services.cultivation_service import recalculate_xp as do_recalc
    try:
        result = do_recalc(current_user.id, db)
        return {"status": "ok", **result}
    except Exception as e:
        logger.exception("XP 重算失败")
        raise AppException(str(e), code=500)


@router.post("/xp/fix")
def fix_xp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    一键修复：重新计算 XP + 段位 + 技能树进度 + 补发遗漏印章。
    """
    from app.services.cultivation_service import recalculate_xp as do_recalc
    from app.services.passport_service import recalculate_stamps as do_recalc_stamps
    try:
        xp_result = do_recalc(current_user.id, db)
        stamp_result = do_recalc_stamps(current_user.id, db)
        return {
            "status": "ok",
            "xp": xp_result,
            "stamps": stamp_result,
        }
    except Exception as e:
        logger.exception("一键修复失败")
        raise AppException(str(e), code=500)
