"""AI 调用账单模型 — 记录每次 AI API 调用的成本"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from app.models.database import Base
from datetime import datetime


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    model = Column(String(30), nullable=False, index=True)
    endpoint = Column(String(50), nullable=False, index=True)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    cost_cny = Column(Float, default=0.0)
    status = Column(String(10), default="success")  # success / error / fallback
    error_msg = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
