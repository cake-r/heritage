"""Admin API — 任务监控"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.database import get_db
from app.models.user import User
from app.models.async_task import AsyncTask
from app.api.deps import get_current_admin
from app.utils.exceptions import AppException

router = APIRouter()


@router.get("/api/admin/tasks/status")
def get_task_queue_status(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """任务队列总览"""
    counts = db.query(
        AsyncTask.status, func.count(AsyncTask.id)
    ).group_by(AsyncTask.status).all()
    status_map = dict(counts)

    # 平均延迟
    avg_latency = db.query(func.avg(AsyncTask.latency_ms)).filter(
        AsyncTask.status == "success"
    ).scalar() or 0.0

    return {
        "pending": status_map.get("pending", 0),
        "running": status_map.get("running", 0),
        "success": status_map.get("success", 0),
        "failed": status_map.get("failed", 0),
        "avg_latency_ms": round(float(avg_latency), 1),
    }


@router.get("/api/admin/tasks")
def list_all_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    task_type: str | None = Query(None),
    user_id: int | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """所有用户的任务列表"""
    q = db.query(AsyncTask)
    if status:
        q = q.filter(AsyncTask.status == status)
    if task_type:
        q = q.filter(AsyncTask.task_type == task_type)
    if user_id:
        q = q.filter(AsyncTask.user_id == user_id)

    total = q.count()
    tasks = q.order_by(AsyncTask.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "task_id": t.task_id,
                "task_type": t.task_type,
                "user_id": t.user_id,
                "status": t.status,
                "progress": t.progress or 0,
                "retry_count": t.retry_count or 0,
                "error_msg": t.error_msg,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ],
    }


@router.post("/api/admin/tasks/{task_id}/retry")
def admin_retry_task(
    task_id: str,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """管理员重试任务"""
    task = db.query(AsyncTask).filter(AsyncTask.task_id == task_id).first()
    if not task:
        raise AppException("任务不存在", code=404)

    task.status = "pending"
    task.retry_count = 0
    task.error_msg = None
    db.commit()

    import json
    from app.services.task_scheduler import _try_enqueue_rq
    if task.payload_json:
        payload = json.loads(task.payload_json)
        _try_enqueue_rq(task.task_type, task.task_id, task.user_id, payload, task.max_retries or 3)

    return {"status": "ok"}


@router.post("/api/admin/tasks/{task_id}/cancel")
def admin_cancel_task(
    task_id: str,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """管理员取消任务"""
    task = db.query(AsyncTask).filter(AsyncTask.task_id == task_id).first()
    if not task:
        raise AppException("任务不存在", code=404)
    if task.status not in ("pending", "running"):
        raise AppException("只能取消进行中的任务", code=400)

    task.status = "cancelled"
    db.commit()
    return {"status": "ok"}
