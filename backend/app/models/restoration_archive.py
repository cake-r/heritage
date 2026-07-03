"""人机协同修复档案表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from app.models.database import Base


class RestorationArchive(Base):
    __tablename__ = "restoration_archives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 原始图片
    original_image_path = Column(String(500), nullable=False)

    # AI 损伤检测完整结果 (JSON)
    damage_report_json = Column(Text)

    # 修复操作序列: [{tool, params, before_url, after_url, timestamp}]
    operations_json = Column(Text)

    # AI 辅助占比 0.0-1.0 (纹样库拖拽 = 低AI, 去渍笔 = 高AI)
    ai_assist_ratio = Column(Float, default=0.0)

    # 最终修复图路径
    final_image_path = Column(String(500))

    # AI 验收 3 维度打分 (JSON)
    verification_json = Column(Text)

    # 导出次数
    export_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
