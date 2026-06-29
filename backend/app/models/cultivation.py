"""修习之路 — 游戏化学习旅程模型"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.database import Base


class UserCultivation(Base):
    """用户修习数据 — 段位/XP/技能树"""

    __tablename__ = "user_cultivation"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    xp = Column(Integer, default=0)
    rank = Column(String(20), default="初窥门径")  # 初窥门径|略有小成|融会贯通|炉火纯青|一代宗师
    skill_tree_json = Column(Text, default="{}")  # {"鉴宝":{"level":1,"current":3,"threshold":5},...}
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="cultivation")


class UserQuest(Base):
    """用户每日任务"""

    __tablename__ = "user_quests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    quest_template_id = Column(String(50), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(String(500), default="")
    module = Column(String(30), default="")
    skill_tree = Column(String(20), default="")
    xp_reward = Column(Integer, default=20)
    status = Column(String(20), default="pending")  # pending|completed|claimed
    date = Column(Date, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "quest_template_id", "date", name="uq_user_quest_date"),
    )

    user = relationship("User", backref="quests")
