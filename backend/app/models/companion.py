"""AI 智能伴游 — 交互记录模型"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime

from app.models.database import Base


class CompanionInteraction(Base):
    """伴游交互记录 — 追踪建议展示/点击/关闭 + 对话消息"""

    __tablename__ = "companion_interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    interaction_type = Column(
        String(30), nullable=False, index=True
    )  # suggestion_shown | suggestion_clicked | suggestion_dismissed | chat_user | chat_assistant
    suggestion_id = Column(String(50), nullable=True, index=True)  # 关联的建议 ID
    page = Column(String(100), nullable=True)  # 触发时的页面路由
    content_json = Column(Text, nullable=True)  # 灵活 JSON 载荷
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
