"""AI生成作品表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Boolean, ForeignKey
from app.models.database import Base


class GeneratedWork(Base):
    __tablename__ = "generated_works"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    prompt = Column(Text, nullable=False)
    negative_prompt = Column(Text, default="")
    base_style = Column(String(50), nullable=False)
    elements_json = Column(Text)         # ["祥云纹","牡丹花"]
    color_palette = Column(String(50))
    composition = Column(String(50))
    intensity = Column(Float, default=0.7)
    seed = Column(Integer)
    mode = Column(String(20), default="text2img")  # text2img | img2img
    ref_image_path = Column(String(500))
    images_json = Column(Text, nullable=False)  # ["path1","path2"]
    params_json = Column(Text)           # 完整参数JSON(用于复现)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
