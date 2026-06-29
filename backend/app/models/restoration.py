"""文物修复记录表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from app.models.database import Base


class RestorationRecord(Base):
    __tablename__ = "restoration_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_image_path = Column(String(500), nullable=False)

    # Step 1: 损伤分析 (Qwen-VL-Max)
    damage_category = Column(String(100))
    damage_types_json = Column(Text)          # ["釉面剥落","裂纹"]
    damage_severity = Column(String(20))       # 轻度/中度/重度
    damage_description = Column(Text)          # 详细分析文本

    # Step 2: 修复方案 (DeepSeek)
    restoration_prompt = Column(Text)

    # Step 3: 图像修复 (通义万相 2.5 I2I)
    restored_images_json = Column(Text)        # ["/static/generated/..."]
    restoration_seed = Column(Integer)

    # Step 4: 修复验证 (Qwen-VL-Max)
    verification_score = Column(Integer)       # 0-100
    verification_json = Column(Text)           # 完整评估报告

    # 管道状态
    pipeline_status = Column(String(20), default="completed")  # completed / failed
    pipeline_error = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
