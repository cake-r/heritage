"""非遗藏品 + 用户上传作品表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from app.models.database import Base


class HeritageItem(Base):
    __tablename__ = "heritage_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    region = Column(String(100))
    era = Column(String(100))
    description = Column(Text)
    techniques_json = Column(Text)    # [{"name":"...","desc":"..."}]
    inheritors_json = Column(Text)   # [{"name":"...","title":"..."}]
    images_json = Column(Text)       # ["path1","path2"]
    cultural_meaning = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserUpload(Base):
    __tablename__ = "user_uploads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    images_json = Column(Text, nullable=False)  # ["path1","path2"]
    category = Column(String(50))
    region = Column(String(100))
    era = Column(String(100))
    techniques_json = Column(Text)    # [{"name":"...","desc":"..."}]
    inheritors_json = Column(Text)   # [{"name":"...","title":"..."}]
    cultural_meaning = Column(Text)
    is_approved = Column(Boolean, default=True)  # 简化: 上传即展示
    created_at = Column(DateTime, default=datetime.utcnow)
