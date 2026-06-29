"""自定义传承人表"""

from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.database import Base


class CustomInheritor(Base):
    __tablename__ = "custom_inheritors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)  # 19种非遗品类之一
    avatar_url = Column(String(500), default="")
    persona = Column(Text, nullable=False)  # system_prompt
    greeting = Column(Text, nullable=False)
    tools_json = Column(Text, default="[]")  # ["inspect", "teach"]
    domain_prompts_json = Column(Text, default="{}")  # {"inspect": "...", "teach": "..."}
    style = Column(String(200), default="")
    expertise = Column(Text, default="[]")  # JSON array of strings
    is_public = Column(Integer, default=0)  # SQLite has no native bool
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="custom_inheritors")
