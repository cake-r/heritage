"""用户兴趣画像模型 — 千人千面推荐引擎"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.database import Base


class UserInterestProfile(Base):
    """用户兴趣画像 — 19维品类偏好 + 技法/地域权重"""

    __tablename__ = "user_interest_profile"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    category_weights_json = Column(Text, default="{}")      # {"刺绣":0.4,"陶瓷":0.3,...}
    technique_weights_json = Column(Text, default="{}")      # {"平针绣":0.2,"滚针":0.15,...}
    region_weights_json = Column(Text, default="{}")          # {"江苏":0.3,"浙江":0.25,...}
    interaction_count = Column(Integer, default=0)             # 冷启动阈值=5
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="interest_profile")
