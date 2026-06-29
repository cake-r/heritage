"""应用配置 — 从环境变量加载"""

import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

# 数据库
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/data/database.sqlite")

# JWT
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

# AI API Keys
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# 文件上传
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"jpg", "jpeg", "png", "webp"}
MIN_IMAGE_DIMENSION = 200  # px

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "data" / "uploads"))
IMAGE_DIR = UPLOAD_DIR / "images"
VOICE_DIR = UPLOAD_DIR / "voices"
EXPORT_DIR = UPLOAD_DIR / "exports"
HEATMAP_DIR = UPLOAD_DIR / "heatmaps"
GENERATED_DIR = UPLOAD_DIR / "generated"

# Mock模式 (答辩备用)
MOCK_MODE = os.getenv("MOCK_MODE", "false").lower() == "true"

# 部署
DEPLOY_ENV = os.getenv("DEPLOY_ENV", "local")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# 确保目录存在
for d in [IMAGE_DIR, VOICE_DIR, EXPORT_DIR, HEATMAP_DIR, GENERATED_DIR]:
    d.mkdir(parents=True, exist_ok=True)
