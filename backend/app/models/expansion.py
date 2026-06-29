"""知识库扩充 — 待审核队列表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.models.database import Base


class ExpansionQueue(Base):
    """扩充队列 — 从互联网抓取的非遗项目，等待用户审核"""

    __tablename__ = "expansion_queue"

    id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(String(20), default="pending", index=True)  # pending | approved | rejected
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    region = Column(String(100))
    era = Column(String(100))
    description = Column(Text)
    techniques_json = Column(Text)    # [{"name":"...","desc":"..."}]
    inheritors_json = Column(Text)   # [{"name":"...","title":"..."}]
    images_json = Column(Text)       # ["path1","path2"]
    cultural_meaning = Column(Text)
    search_keyword = Column(String(200))     # 使用的搜索关键词
    source_urls_json = Column(Text)           # ["url1", "url2"] 数据来源URL
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
