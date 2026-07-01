"""异步任务模型 — 持久化任务队列 (零外部依赖)"""

import uuid
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from app.models.database import Base


def _gen_task_id() -> str:
    return uuid.uuid4().hex[:12]


class AsyncTask(Base):
    __tablename__ = "async_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(36), unique=True, nullable=False, default=_gen_task_id, index=True)
    task_type = Column(String(30), nullable=False, index=True)  # restoration / image_gen / tts / recognition
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    payload_json = Column(Text, nullable=False, default="{}")
    status = Column(String(10), nullable=False, default="pending", index=True)  # pending / running / success / failed
    progress = Column(Integer, default=0)  # 0-100
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_msg = Column(Text, nullable=True)
    result_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
