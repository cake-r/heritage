"""串行写入队列 — 将所有后台 DB 写操作收敛到单线程，避免 SQLite 锁竞争

与 run_in_thread 的区别：
- run_in_thread: 每个任务独立线程，适合读操作和 AI 调用
- write_queue: 单线程串行执行，适合 DB 写操作（XP/印章/画像/时间戳）

配合 WAL 模式：WAL 允许一写多读并发，串行队列确保不会多写冲突。
"""

import queue
import threading
import logging
from typing import Callable, Any

logger = logging.getLogger("ich_backend.write_queue")

_write_queue: queue.Queue[tuple] = queue.Queue()


def _serial_worker():
    """单线程消费者：串行执行队列中的所有写任务"""
    while True:
        try:
            fn, args, kwargs, name = _write_queue.get()
            try:
                fn(*args, **kwargs)
                logger.debug("write_queue [%s] 完成", name)
            except Exception:
                logger.exception("write_queue [%s] 失败", name)
            finally:
                _write_queue.task_done()
        except Exception:
            # 队列取任务本身异常，不应发生
            logger.exception("write_queue worker 异常")
            continue


# 启动消费者线程
_worker_thread = threading.Thread(
    target=_serial_worker, name="db-write-queue", daemon=True
)
_worker_thread.start()


def enqueue_write(fn: Callable[..., Any], *args, name: str = "write", **kwargs) -> None:
    """
    将写操作放入串行队列，在后台单线程中执行。

    用法：
        enqueue_write(lambda: some_db_write(user_id), name="xp_award")
        enqueue_write(some_fn, arg1, arg2, name="stamp_check")

    注意：
        fn 内部必须使用独立的 SessionLocal()，不得捕获外部 db session。
        与 run_in_thread 遵循相同的 ORM 跨线程铁律。
    Mock 模式下跳过写入，避免干扰测试 DB 清理。
    """
    from app.services.ai.base import mock_mode
    if mock_mode():
        logger.debug("write_queue [%s] Mock 模式跳过", name)
        return
    _write_queue.put((fn, args, kwargs, name))
    logger.debug("write_queue [%s] 已入队 (队列长度 ~%d)", name, _write_queue.qsize())


def get_queue_depth() -> int:
    """获取当前队列深度（用于健康检查/监控）"""
    return _write_queue.qsize()


def enqueue_write_rq(fn: Callable[..., Any], *args, name: str = "write", **kwargs) -> bool:
    """
    Redis 可用时通过 RQ 队列分发写任务 (多进程安全)。
    否则降级到本地串行队列 enqueue_write()。

    返回 True 表示已提交到 RQ，False 表示使用了本地队列降级。
    """
    from app.services.ai.base import mock_mode
    if mock_mode():
        logger.debug("write_queue [%s] Mock 模式跳过", name)
        return False

    from app.utils.redis_client import is_redis_available
    if is_redis_available():
        try:
            import redis as redis_lib
            from rq import Queue
            from app.config import REDIS_URL
            redis_conn = redis_lib.from_url(REDIS_URL)
            q = Queue("db_writes", connection=redis_conn)
            q.enqueue(fn, *args, **kwargs)
            logger.debug("write_queue [%s] RQ 入队", name)
            return True
        except Exception:
            logger.warning("write_queue [%s] RQ 提交失败，降级本地队列", name)

    # 降级: 本地串行队列
    enqueue_write(fn, *args, name=name, **kwargs)
    return False
