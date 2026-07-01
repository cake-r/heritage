"""非遗知识分块模型 — RAG 细粒度检索"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.models.database import Base


class HeritageChunk(Base):
    """非遗条目的语义分块 — 按 description/technique/cultural_meaning/inheritor_desc 拆分"""

    __tablename__ = "heritage_chunks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    heritage_item_id = Column(Integer, ForeignKey("heritage_items.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_type = Column(String(20), nullable=False, index=True)  # description | technique | cultural_meaning | inheritor_desc
    chunk_text = Column(Text, nullable=False)
    # embedding 字段: PG 使用 pgvector vector(1024), SQLite 使用 TEXT (JSON 序列化)
    embedding_json = Column(Text, nullable=True)  # JSON 序列化的 1024 维向量 (SQLite/通用)
    metadata_json = Column(Text, nullable=True)    # {technique_name, inheritor_name, ...}
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<HeritageChunk id={self.id} type={self.chunk_type} item={self.heritage_item_id}>"
