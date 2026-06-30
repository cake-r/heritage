"""FastAPI 应用入口"""

from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

import logging

from fastapi import Request
from fastapi.responses import JSONResponse

from app.config import CORS_ORIGINS, DEPLOY_ENV, MOCK_MODE, UPLOAD_DIR
from app.models.database import init_db
from app.schemas.common import ErrorResponse
from app.utils.exceptions import AppException
from app.utils.middleware import log_requests

logger = logging.getLogger("ich_backend")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """添加安全响应头，缓解 XSS/点击劫持等攻击"""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # CSP: 限制脚本来源，防止 XSS token 窃取
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https: wss:; "
            "media-src 'self' data: blob:; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭生命周期"""
    init_db()
    yield


app = FastAPI(
    title="非遗数字交互与文创生成系统",
    description="基于多模态大模型的非遗数字交互与文创生成系统 API",
    version="1.0.0",
    docs_url="/api/docs" if DEPLOY_ENV != "cloud" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求日志中间件
app.middleware("http")(log_requests)

# 安全响应头（CSP + XSS 防护）
app.add_middleware(SecurityHeadersMiddleware)

# 静态文件挂载
app.mount("/static", StaticFiles(directory=str(UPLOAD_DIR)), name="static")


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "mock_mode": MOCK_MODE}


# === 全局异常处理 ===

@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    """自定义应用异常 → 统一 ErrorResponse 格式"""
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            detail=exc.detail,
            error_code="APP_ERROR" if exc.status_code < 500 else "INTERNAL_ERROR",
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """未捕获异常 → 500 + 统一 ErrorResponse"""
    logger.error(f"未处理异常 {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            detail="服务器内部错误",
            error_code="INTERNAL_ERROR",
        ).model_dump(),
    )


# === 路由注册 ===
from app.api import auth, recognition, generation, exhibition, user, chat, knowledge_graph, tools, inheritor, restoration, passport, expansion, recommendation, cultivation, companion
app.include_router(auth.router, prefix="/api/auth", tags=["鉴权"])
app.include_router(recognition.router, prefix="/api/recognition", tags=["识别讲解"])
app.include_router(generation.router, prefix="/api/generation", tags=["文创生成"])
app.include_router(exhibition.router, prefix="/api/exhibition", tags=["数字展厅"])
app.include_router(user.router, prefix="/api/user", tags=["个人中心"])
app.include_router(chat.router, prefix="/api/chat", tags=["传承人对话"])
app.include_router(knowledge_graph.router, prefix="/api/knowledge-graph", tags=["文化图谱"])
app.include_router(tools.router)
app.include_router(inheritor.router)
app.include_router(restoration.router, prefix="/api/restoration", tags=["文物修复"])
app.include_router(passport.router, prefix="/api/passport", tags=["数字护照"])
app.include_router(expansion.router, prefix="/api/expansion", tags=["知识扩充"])
app.include_router(recommendation.router, prefix="/api/recommendations", tags=["个性化推荐"])
app.include_router(cultivation.router, prefix="/api/cultivation", tags=["修习之路"])
app.include_router(companion.router, prefix="/api/companion", tags=["智能伴游"])
