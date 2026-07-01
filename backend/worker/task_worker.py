"""RQ Worker 入口 — 消费异步任务队列

用法:
    python -m worker.task_worker

环境变量:
    REDIS_URL — Redis 连接字符串
    DATABASE_URL — 数据库连接字符串 (写入结果用)
    WORKER_QUEUES — 监听的队列名 (逗号分隔，默认: ai_tasks,db_writes)

在 SQLite 模式 (未设置 REDIS_URL) 下，此 Worker 不启动，
而是使用内置的 task_scheduler 轮询线程。
"""

import os
import sys
import logging
from pathlib import Path

# 确保 backend 在 sys.path 中
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.config import REDIS_ENABLED, REDIS_URL  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("worker")


def main():
    if not REDIS_ENABLED:
        logger.warning(
            "REDIS_URL 未设置，Worker 不启动。"
            "请使用内置 task_scheduler (SQLite 轮询模式)。"
        )
        return

    import redis as redis_lib
    from rq import Worker, Queue, Connection

    queue_names = os.getenv("WORKER_QUEUES", "ai_tasks,db_writes").split(",")
    queue_names = [q.strip() for q in queue_names if q.strip()]

    logger.info("连接 Redis: %s", REDIS_URL)
    redis_conn = redis_lib.from_url(REDIS_URL)

    queues = [Queue(name, connection=redis_conn) for name in queue_names]

    with Connection(redis_conn):
        worker = Worker(queues)
        logger.info("RQ Worker 启动, 监听队列: %s", queue_names)
        worker.work()


if __name__ == "__main__":
    main()
