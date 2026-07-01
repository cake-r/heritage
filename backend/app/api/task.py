"""异步任务 API — 查询/列表/重试 + WebSocket 实时推送"""

import json
import logging
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.models.async_task import AsyncTask
from app.api.deps import get_current_user, get_optional_user_ws
from app.utils.exceptions import AppException

logger = logging.getLogger("task_api")
router = APIRouter()


# === WebSocket 连接管理 ===

class TaskWSManager:
    """管理任务状态的 WebSocket 连接 — 支持一对多广播"""

    def __init__(self):
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, task_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.setdefault(task_id, []).append(ws)

    def disconnect(self, task_id: str, ws: WebSocket) -> None:
        if task_id in self._connections:
            self._connections[task_id] = [c for c in self._connections[task_id] if c != ws]
            if not self._connections[task_id]:
                del self._connections[task_id]

    async def broadcast(self, task_id: str, data: dict) -> None:
        """向所有订阅该任务的客户端推送"""
        if task_id not in self._connections:
            return
        dead: list[WebSocket] = []
        for ws in self._connections[task_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(task_id, ws)


ws_manager = TaskWSManager()


# === HTTP 端点 ===

@router.get("/api/tasks/{task_id}")
def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查询单个任务状态"""
    task = db.query(AsyncTask).filter(
        AsyncTask.task_id == task_id,
        AsyncTask.user_id == current_user.id,
    ).first()
    if not task:
        raise AppException("任务不存在", code=404)
    return {
        "task_id": task.task_id,
        "task_type": task.task_type,
        "status": task.status,
        "progress": task.progress or 0,
        "error_msg": task.error_msg,
        "result_json": task.result_json,
        "retry_count": task.retry_count or 0,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


@router.get("/api/tasks")
def list_tasks(
    status: str | None = Query(None),
    task_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户任务列表"""
    q = db.query(AsyncTask).filter(AsyncTask.user_id == current_user.id)
    if status:
        q = q.filter(AsyncTask.status == status)
    if task_type:
        q = q.filter(AsyncTask.task_type == task_type)
    tasks = q.order_by(AsyncTask.created_at.desc()).limit(limit).all()
    return [
        {
            "task_id": t.task_id,
            "task_type": t.task_type,
            "status": t.status,
            "progress": t.progress or 0,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in tasks
    ]


@router.post("/api/tasks/{task_id}/retry")
def retry_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """重试失败的任务"""
    task = db.query(AsyncTask).filter(
        AsyncTask.task_id == task_id,
        AsyncTask.user_id == current_user.id,
    ).first()
    if not task:
        raise AppException("任务不存在", code=404)
    if task.status != "failed":
        raise AppException("只能重试失败的任务", code=400)

    task.status = "pending"
    task.retry_count = 0
    task.error_msg = None
    db.commit()

    # 尝试重新推送到 RQ
    from app.services.task_scheduler import _try_enqueue_rq
    if task.payload_json:
        payload = json.loads(task.payload_json)
        _try_enqueue_rq(task.task_type, task.task_id, task.user_id, payload, task.max_retries or 3)

    return {"status": "ok", "message": "任务已重新加入队列"}


# === WebSocket 端点 ===

@router.websocket("/api/tasks/{task_id}/ws")
async def task_websocket(websocket: WebSocket, task_id: str):
    """WebSocket 端点: 订阅任务状态实时推送

    客户端可发送 "cancel" 取消任务。

    连接建立后立即推送当前状态，之后每当 Worker 更新进度时自动推送。
    """
    # 验证 token (从查询参数取)
    token = websocket.query_params.get("token")
    user = await get_optional_user_ws(token)
    if user is None:
        await websocket.close(code=4001, reason="未登录")
        return

    # 验证任务归属
    db = next(get_db())
    try:
        task = db.query(AsyncTask).filter(
            AsyncTask.task_id == task_id,
            AsyncTask.user_id == user.id,
        ).first()
        if not task:
            await websocket.close(code=4004, reason="任务不存在")
            return
    finally:
        db.close()

    await ws_manager.connect(task_id, websocket)

    # 立即推送当前状态
    await websocket.send_json({
        "task_id": task_id,
        "status": task.status,
        "progress": task.progress or 0,
    })

    try:
        while True:
            data = await websocket.receive_text()
            if data == "cancel":
                _cancel_task(task_id, user.id)
                await websocket.send_json({
                    "task_id": task_id,
                    "status": "cancelled",
                    "progress": 0,
                })
                break
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(task_id, websocket)


def _cancel_task(task_id: str, user_id: int) -> None:
    """取消任务"""
    db = next(get_db())
    try:
        task = db.query(AsyncTask).filter(
            AsyncTask.task_id == task_id,
            AsyncTask.user_id == user_id,
        ).first()
        if task and task.status in ("pending", "running"):
            task.status = "cancelled"
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
