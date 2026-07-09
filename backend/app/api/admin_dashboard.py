"""Admin API — 数据驾驶舱（聚合指标 + 趋势 + 榜单）"""
import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from datetime import datetime, timedelta, date

from app.models.database import get_db
from app.models.user import User
from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.restoration import RestorationRecord
from app.models.chat import ChatSession
from app.models.passport import PassportStamp
from app.models.exhibition import HeritageItem
from app.models.heritage_chunk import HeritageChunk
from app.models.pattern_gene import PatternGene
from app.models.ai_usage import AIUsageLog
from app.models.async_task import AsyncTask
from app.api.deps import get_current_admin
from app.schemas.admin import (
    DashboardOverview,
    DailyTrend,
    LeaderboardEntry,
    DashboardLeaderboard,
)

logger = logging.getLogger("admin_dashboard")
router = APIRouter()


# ── 工具函数 ──

def _safe_count(db: Session, model, *filters) -> int:
    """安全计数，表达式求值为标量或0"""
    q = db.query(func.count(model.id))
    for f in filters:
        q = q.filter(f)
    return q.scalar() or 0


def _safe_sum(db: Session, column, *filters):
    """安全求和"""
    q = db.query(func.sum(column))
    for f in filters:
        q = q.filter(f)
    return q.scalar() or 0.0


# ── 概览端点 ──

@router.get("/api/admin/dashboard/overview", response_model=DashboardOverview)
def get_overview(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """聚合查询所有核心指标"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 基础计数
    total_users = _safe_count(db, User)
    total_recognitions = _safe_count(db, RecognitionRecord)
    total_restorations = _safe_count(db, RestorationRecord)
    total_generations = _safe_count(db, GeneratedWork)
    total_chat_sessions = _safe_count(db, ChatSession)
    total_stamps = _safe_count(db, PassportStamp)
    knowledge_base_size = _safe_count(db, HeritageItem) + _safe_count(db, HeritageChunk)
    pattern_genes_count = _safe_count(db, PatternGene)

    # 今日活跃用户：从 ai_usage_logs 查询今日有 API 调用的 distinct user_id
    active_today = db.query(func.count(distinct(AIUsageLog.user_id))).filter(
        AIUsageLog.created_at >= today_start,
        AIUsageLog.user_id.isnot(None),
    ).scalar() or 0

    # AI 成本
    ai_cost_today = _safe_sum(db, AIUsageLog.cost_cny, AIUsageLog.created_at >= today_start)
    ai_cost_month = _safe_sum(db, AIUsageLog.cost_cny, AIUsageLog.created_at >= month_start)

    # 任务队列
    task_pending = _safe_count(db, AsyncTask, AsyncTask.status == "pending")
    task_running = _safe_count(db, AsyncTask, AsyncTask.status == "running")

    return DashboardOverview(
        total_users=total_users,
        total_recognitions=total_recognitions,
        total_restorations=total_restorations,
        total_generations=total_generations,
        total_chat_sessions=total_chat_sessions,
        total_stamps_earned=total_stamps,
        active_users_today=active_today,
        ai_cost_today=round(float(ai_cost_today), 4),
        ai_cost_month=round(float(ai_cost_month), 4),
        task_pending=task_pending,
        task_running=task_running,
        knowledge_base_size=knowledge_base_size,
        pattern_genes_count=pattern_genes_count,
    )


# ── 趋势端点 ──

@router.get("/api/admin/dashboard/trends")
def get_trends(
    days: int = Query(7, ge=1, le=90),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """7/30/90 日趋势数据（按日聚合）"""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # 每日活跃用户
    dau_rows = db.query(
        func.date(AIUsageLog.created_at).label("day"),
        func.count(distinct(AIUsageLog.user_id)).label("count"),
    ).filter(
        AIUsageLog.created_at >= cutoff,
        AIUsageLog.user_id.isnot(None),
    ).group_by("day").order_by("day").all()
    dau_map = {str(r.day): r.count for r in dau_rows}

    # 每日识别量
    rec_rows = db.query(
        func.date(RecognitionRecord.created_at).label("day"),
        func.count(RecognitionRecord.id),
    ).filter(RecognitionRecord.created_at >= cutoff).group_by("day").order_by("day").all()
    rec_map = {str(r.day): r[1] for r in rec_rows}

    # 每日修复量
    rest_rows = db.query(
        func.date(RestorationRecord.created_at).label("day"),
        func.count(RestorationRecord.id),
    ).filter(RestorationRecord.created_at >= cutoff).group_by("day").order_by("day").all()
    rest_map = {str(r.day): r[1] for r in rest_rows}

    # 每日创作量
    gen_rows = db.query(
        func.date(GeneratedWork.created_at).label("day"),
        func.count(GeneratedWork.id),
    ).filter(GeneratedWork.created_at >= cutoff).group_by("day").order_by("day").all()
    gen_map = {str(r.day): r[1] for r in gen_rows}

    # 每日 AI 成本
    cost_rows = db.query(
        func.date(AIUsageLog.created_at).label("day"),
        func.sum(AIUsageLog.cost_cny),
    ).filter(AIUsageLog.created_at >= cutoff).group_by("day").order_by("day").all()
    cost_map = {str(r.day): round(float(r[1] or 0), 4) for r in cost_rows}

    # 每日新注册
    newuser_rows = db.query(
        func.date(User.created_at).label("day"),
        func.count(User.id),
    ).filter(User.created_at >= cutoff).group_by("day").order_by("day").all()
    newuser_map = {str(r.day): r[1] for r in newuser_rows}

    # 构建日期序列
    trends = []
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).date()
        ds = str(d)
        trends.append({
            "date": ds,
            "active_users": dau_map.get(ds, 0),
            "recognitions": rec_map.get(ds, 0),
            "restorations": rest_map.get(ds, 0),
            "generations": gen_map.get(ds, 0),
            "cost": cost_map.get(ds, 0.0),
            "new_users": newuser_map.get(ds, 0),
        })

    return {"days": days, "trends": trends}


# ── 排行榜端点 ──

@router.get("/api/admin/dashboard/leaderboard", response_model=DashboardLeaderboard)
def get_leaderboard(
    limit: int = Query(10, ge=3, le=50),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """热门非遗榜单 + 活跃用户排名"""

    # 品类热门
    cat_rows = db.query(
        RecognitionRecord.category,
        func.count(RecognitionRecord.id).label("cnt"),
    ).filter(RecognitionRecord.category.isnot(None), RecognitionRecord.category != "").group_by(
        RecognitionRecord.category
    ).order_by(func.count(RecognitionRecord.id).desc()).limit(limit).all()
    top_categories = [
        LeaderboardEntry(name=r.category, value=r.cnt) for r in cat_rows if r.category
    ]

    # 地域热门（从 recognition + heritage 聚合）
    region_rows = db.query(
        HeritageItem.region,
        func.count(HeritageItem.id).label("cnt"),
    ).filter(HeritageItem.region.isnot(None), HeritageItem.region != "").group_by(
        HeritageItem.region
    ).order_by(func.count(HeritageItem.id).desc()).limit(limit).all()
    top_regions = [
        LeaderboardEntry(name=r.region, value=r.cnt) for r in region_rows if r.region
    ]

    # 年代热门
    era_rows = db.query(
        HeritageItem.era,
        func.count(HeritageItem.id).label("cnt"),
    ).filter(HeritageItem.era.isnot(None), HeritageItem.era != "").group_by(
        HeritageItem.era
    ).order_by(func.count(HeritageItem.id).desc()).limit(limit).all()
    top_eras = [
        LeaderboardEntry(name=r.era, value=r.cnt) for r in era_rows if r.era
    ]

    # 活跃用户（按印章数）
    user_rows = db.query(
        PassportStamp.user_id,
        func.count(PassportStamp.id).label("stamp_count"),
    ).group_by(PassportStamp.user_id).order_by(
        func.count(PassportStamp.id).desc()
    ).limit(limit).all()
    top_user_entries = []
    if user_rows:
        user_ids = [r.user_id for r in user_rows]
        users_map = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        for r in user_rows:
            user = users_map.get(r.user_id)
            name = user.nickname or user.username if user else f"User#{r.user_id}"
            top_user_entries.append(LeaderboardEntry(name=name, value=r.stamp_count))

    return DashboardLeaderboard(
        top_categories=top_categories,
        top_regions=top_regions,
        top_eras=top_eras,
        top_users=top_user_entries,
    )
