"""识别记录表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from app.models.database import Base


class RecognitionRecord(Base):
    __tablename__ = "recognition_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_path = Column(String(500), nullable=False)
    category = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=False)

    # JSON字符串
    top3_json = Column(Text)          # [{"category":"...","confidence":0.xx},...]
    features_json = Column(Text)      # ["平针绣","套针"]
    explanation_json = Column(Text)   # {history, technique, inheritor, meaning}
    raw_response_json = Column(Text)  # Qwen-VL原始响应

    heatmap_path = Column(String(500))
    heatmap_data_json = Column(Text)   # [{name, x, y, label}] 前端交互热点数据
    voice_path = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
