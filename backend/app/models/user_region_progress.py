"""用户地域探索进度模型"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from app.models.database import Base


class UserRegionProgress(Base):
    __tablename__ = "user_region_progress"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    region_code = Column(String(50), nullable=False)   # 省份短名，如 "江苏"
    unlocked_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "region_code", name="uq_user_region"),
    )
