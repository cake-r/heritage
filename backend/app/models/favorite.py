"""收藏表 (多态) + 用户设置表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from app.models.database import Base


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "item_type", "item_id", name="uq_favorite"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_type = Column(String(20), nullable=False)  # heritage | generated | user_upload
    item_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    voice_speed = Column(Float, default=1.0)
    theme = Column(String(20), default="light")
