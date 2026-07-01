"""轻量持久化任务调度器 — 单线程轮询 + 崩溃恢复 + 指数退避重试

完全不引入 Redis/Celery，基于 SQLite + 轮询实现任务队列。
"""

import json
import time
import threading
import logging
from datetime import datetime
from typing import Callable, Any

from app.models.database import SessionLocal
from app.models.async_task import AsyncTask

logger = logging.getLogger("task_scheduler")

# 任务处理器注册表 — 启动时注册
_HANDLERS: dict[str, Callable] = {}  # {task_type: handler_fn}

# 调度器状态
_scheduler_running = False
_poll_interval = 1.0  # 秒


def register_handler(task_type: str, handler: Callable[[dict, AsyncTask], dict]):
    """
    注册任务处理器。
    handler(task_type, payload: dict, task: AsyncTask) -> dict (result_json)
    """
    _HANDLERS[task_type] = handler
    logger.info(f"注册任务处理器: {task_type}")


def _recover_crashed_tasks():
    """启动时扫描 running 状态的任务，重置为 pending（崩溃恢复）"""
    db = SessionLocal()
    try:
        crashed = db.query(AsyncTask).filter(
            AsyncTask.status == "running"
        ).all()
        for task in crashed:
            task.status = "pending"
            task.retry_count = (task.retry_count or 0) + 1
            if task.retry_count >= (task.max_retries or 3):
                task.status = "failed"
                task.error_msg = "任务在运行中崩溃，已达最大重试次数"
                task.completed_at = datetime.utcnow()
            logger.warning(f"恢复崩溃任务 {task.task_id} (重试 {task.retry_count})")
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"崩溃恢复扫描失败: {e}")
    finally:
        db.close()


def _scheduler_loop():
    """主调度循环 — 轮询 pending 任务，串行执行"""
    global _scheduler_running
    _scheduler_running = True
    logger.info("任务调度器启动")

    while _scheduler_running:
        task = _fetch_next_pending()
        if task is None:
            time.sleep(_poll_interval)
            continue

        handler = _HANDLERS.get(task.task_type)
        if not handler:
            logger.error(f"未注册的任务类型: {task.task_type}")
            _mark_failed(task, f"未知任务类型: {task.task_type}")
            continue

        try:
            payload = json.loads(task.payload_json) if task.payload_json else {}
            result = handler(task.task_type, payload, task)
            _mark_success(task, result)
        except Exception as e:
            logger.exception(f"任务 {task.task_id} 执行失败")
            _handle_failure(task, str(e))


def _fetch_next_pending() -> AsyncTask | None:
    """获取下一个待处理任务"""
    db = SessionLocal()
    try:
        task = db.query(AsyncTask).filter(
            AsyncTask.status == "pending"
        ).order_by(AsyncTask.created_at).first()
        if task:
            # 标记为 running
            task.status = "running"
            task.started_at = datetime.utcnow()
            db.commit()
            db.refresh(task)
            # 脱离 session 返回
            return db.query(AsyncTask).filter(AsyncTask.id == task.id).first()
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"拉取任务失败: {e}")
        return None
    finally:
        db.close()


def _mark_success(task: AsyncTask, result: dict):
    """标记任务成功"""
    db = SessionLocal()
    try:
        t = db.query(AsyncTask).filter(AsyncTask.id == task.id).first()
        if t:
            t.status = "success"
            t.progress = 100
            t.result_json = json.dumps(result, ensure_ascii=False)
            t.completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"任务 {t.task_id} 完成")
    except Exception as e:
        db.rollback()
        logger.error(f"标记任务成功失败: {e}")
    finally:
        db.close()


def _handle_failure(task: AsyncTask, error_msg: str):
    """处理任务失败 — 根据重试次数决定重试还是标记失败"""
    db = SessionLocal()
    try:
        t = db.query(AsyncTask).filter(AsyncTask.id == task.id).first()
        if not t:
            return
        t.error_msg = error_msg[:1000]
        t.retry_count = (t.retry_count or 0) + 1

        if t.retry_count < (t.max_retries or 3):
            # 指数退避：1s → 2s → 4s
            delay = 2 ** (t.retry_count - 1)
            logger.warning(f"任务 {t.task_id} 失败，{delay}s 后重试 (第 {t.retry_count} 次)")
            t.status = "pending"
            db.commit()
            time.sleep(delay)
        else:
            t.status = "failed"
            t.completed_at = datetime.utcnow()
            logger.error(f"任务 {t.task_id} 最终失败 (已重试 {t.retry_count} 次)")
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"处理任务失败时出错: {e}")
    finally:
        db.close()


def _mark_failed(task: AsyncTask, error_msg: str):
    """直接标记失败（不重试）"""
    db = SessionLocal()
    try:
        t = db.query(AsyncTask).filter(AsyncTask.id == task.id).first()
        if t:
            t.status = "failed"
            t.error_msg = error_msg[:1000]
            t.completed_at = datetime.utcnow()
            db.commit()
    except Exception as e:
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """启动任务调度器 — 在 FastAPI lifespan 中调用"""
    _recover_crashed_tasks()
    thread = threading.Thread(target=_scheduler_loop, name="task-scheduler", daemon=True)
    thread.start()
    logger.info("任务调度器线程已启动")


def stop_scheduler():
    """停止调度器"""
    global _scheduler_running
    _scheduler_running = False
    logger.info("任务调度器已停止")


def submit_task(
    task_type: str,
    user_id: int,
    payload: dict,
    max_retries: int = 3,
) -> str:
    """
    提交任务到队列，立即返回 task_id。

    Redis 可用时: 持久化到 async_tasks 表 + 推送到 RQ 队列 (Worker 消费)
    SQLite 模式: 仅持久化到 async_tasks 表 (轮询线程消费)

    返回的 task_id 可用于查询 GET /api/tasks/{task_id}
    """
    import uuid
    task_id = uuid.uuid4().hex[:12]

    db = SessionLocal()
    try:
        task = AsyncTask(
            task_id=task_id,
            task_type=task_type,
            user_id=user_id,
            payload_json=json.dumps(payload, ensure_ascii=False),
            status="pending",
            max_retries=max_retries,
        )
        db.add(task)
        db.commit()

        # 尝试推送到 RQ (如果 Redis 可用)
        _try_enqueue_rq(task_type, task_id, user_id, payload, max_retries)

        logger.info(f"任务已提交: {task_id} (类型: {task_type})")
        return task_id
    except Exception as e:
        db.rollback()
        logger.error(f"提交任务失败: {e}")
        raise
    finally:
        db.close()


def _try_enqueue_rq(
    task_type: str,
    task_id: str,
    user_id: int,
    payload: dict,
    max_retries: int,
) -> bool:
    """尝试将任务推送到 RQ 队列。Redis 不可用时返回 False。"""
    from app.utils.redis_client import is_redis_available
    if not is_redis_available():
        return False

    handler = _HANDLERS.get(task_type)
    if not handler:
        logger.warning(f"任务类型 {task_type} 无对应处理器，无法推送到 RQ")
        return False

    try:
        import redis as redis_lib
        from rq import Queue
        from app.config import REDIS_URL

        redis_conn = redis_lib.from_url(REDIS_URL)
        q = Queue("ai_tasks", connection=redis_conn)
        q.enqueue(
            _rq_handler_wrapper,
            task_type=task_type,
            task_id=task_id,
            user_id=user_id,
            payload=payload,
            job_timeout=600,  # 10 分钟超时
            retry=max_retries,
        )
        logger.info(f"任务 {task_id} 已推送到 RQ")
        return True
    except Exception as e:
        logger.warning(f"RQ 推送失败 ({task_id})，回退到轮询: {e}")
        return False


def _rq_handler_wrapper(
    task_type: str,
    task_id: str,
    user_id: int,
    payload: dict,
) -> dict:
    """RQ Worker 调用包装器 — 执行处理器并更新 async_tasks 表状态"""
    import json as _json
    from datetime import datetime as _dt

    handler = _HANDLERS.get(task_type)
    if not handler:
        raise ValueError(f"未知任务类型: {task_type}")

    # 更新进度到 Redis (供 WebSocket 推送)
    from app.utils.redis_client import redis_set_json
    redis_set_json(f"session:task:{task_id}", {
        "status": "running",
        "progress": 10,
    }, ttl=3600)

    try:
        # 执行实际处理器
        result = handler(task_type, payload, None)

        # 标记成功
        db = SessionLocal()
        try:
            t = db.query(AsyncTask).filter(AsyncTask.task_id == task_id).first()
            if t:
                t.status = "success"
                t.progress = 100
                t.result_json = _json.dumps(result, ensure_ascii=False)
                t.completed_at = _dt.utcnow()
                db.commit()
        finally:
            db.close()

        redis_set_json(f"session:task:{task_id}", {
            "status": "success",
            "progress": 100,
            "result": result,
        }, ttl=3600)

        return result

    except Exception as e:
        # 标记失败
        db = SessionLocal()
        try:
            t = db.query(AsyncTask).filter(AsyncTask.task_id == task_id).first()
            if t:
                t.status = "failed"
                t.error_msg = str(e)[:1000]
                t.completed_at = _dt.utcnow()
                db.commit()
        finally:
            db.close()

        redis_set_json(f"session:task:{task_id}", {
            "status": "failed",
            "error": str(e),
        }, ttl=3600)

        raise
