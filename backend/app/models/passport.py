"""数字文博护照 - 印章记录模型"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from app.models.database import Base


class PassportStamp(Base):
    __tablename__ = "passport_stamps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    stamp_type = Column(String(50), nullable=False)        # 印章类型标识
    module = Column(String(50), nullable=False)              # 所属模块
    progress = Column(Integer, default=1)                    # 进度计数（重复获取时递增）
    earned_at = Column(DateTime, default=datetime.utcnow)   # 首次获得时间

    __table_args__ = (
        UniqueConstraint("user_id", "stamp_type", name="uq_user_stamp"),
    )
