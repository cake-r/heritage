"""Admin API — AI 成本看板"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

from app.models.database import get_db
from app.models.user import User
from app.models.ai_usage import AIUsageLog
from app.api.deps import get_current_admin

router = APIRouter()


@router.get("/api/admin/costs/summary")
def get_cost_summary(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """成本总览 — 按模型/端点/日期聚合"""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # 总计
    total = db.query(func.sum(AIUsageLog.cost_cny)).filter(
        AIUsageLog.created_at >= cutoff
    ).scalar() or 0.0

    # 按模型
    by_model_rows = db.query(
        AIUsageLog.model, func.sum(AIUsageLog.cost_cny)
    ).filter(AIUsageLog.created_at >= cutoff).group_by(AIUsageLog.model).all()
    by_model = {model: round(float(cost), 4) for model, cost in by_model_rows if model}

    # 按端点
    by_endpoint_rows = db.query(
        AIUsageLog.endpoint, func.sum(AIUsageLog.cost_cny)
    ).filter(AIUsageLog.created_at >= cutoff).group_by(AIUsageLog.endpoint).all()
    by_endpoint = {ep: round(float(cost), 4) for ep, cost in by_endpoint_rows if ep}

    # 按日 (SQLite/PG 兼容: func.date 替代 cast)
    by_day_rows = db.query(
        func.date(AIUsageLog.created_at).label("date"),
        func.sum(AIUsageLog.cost_cny).label("cost"),
        func.count(AIUsageLog.id).label("count"),
    ).filter(AIUsageLog.created_at >= cutoff).group_by("date").order_by("date").all()
    by_day = [
        {"date": str(row.date), "cost": round(float(row.cost), 4), "count": row.count}
        for row in by_day_rows
    ]

    return {
        "total_cost": round(float(total), 4),
        "by_model": by_model,
        "by_endpoint": by_endpoint,
        "by_day": by_day,
    }


@router.get("/api/admin/costs/logs")
def get_cost_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: int | None = Query(None),
    model: str | None = Query(None),
    status: str | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """AI 调用明细 (分页)"""
    q = db.query(AIUsageLog)
    if user_id:
        q = q.filter(AIUsageLog.user_id == user_id)
    if model:
        q = q.filter(AIUsageLog.model == model)
    if status:
        q = q.filter(AIUsageLog.status == status)

    total = q.count()
    logs = q.order_by(AIUsageLog.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "model": log.model,
                "endpoint": log.endpoint,
                "tokens_in": log.tokens_in or 0,
                "tokens_out": log.tokens_out or 0,
                "latency_ms": log.latency_ms or 0,
                "cost_cny": float(log.cost_cny) if log.cost_cny else 0,
                "status": log.status,
                "error_msg": log.error_msg,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
