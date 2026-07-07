"""Prompt 管理表 — Phase C Step 8 极简版"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from app.models.database import Base


class Prompt(Base):
    """系统 Prompt 版本管理

    启动时从 DB 加载 is_active=True 的版本到内存缓存。
    管理后台支持：列表查看、编辑内容、切换激活版本、查看历史。
    """
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    module = Column(String(50), nullable=False, index=True, comment="模块标识: recognition/companion/generation/story/recommendation")
    version = Column(Integer, nullable=False, default=1, comment="版本号，同模块内自增")
    content = Column(Text, nullable=False, comment="Prompt 完整文本内容")
    is_active = Column(Boolean, default=False, comment="是否为当前激活版本")
    description = Column(String(200), default="", comment="版本变更描述")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
