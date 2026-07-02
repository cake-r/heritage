"""纹样基因模型"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.models.database import Base


class PatternGene(Base):
    __tablename__ = "pattern_genes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gene_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    shape_category = Column(String(50), nullable=False, index=True)
    meaning = Column(String(50), index=True)
    era = Column(String(50))
    region = Column(String(100))
    description = Column(Text)
    svg_viewbox = Column(String(50))
    svg_content = Column(Text)
    default_color = Column(String(20))
    tags_json = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
