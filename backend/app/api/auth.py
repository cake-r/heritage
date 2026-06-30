"""鉴权API — 注册/登录/获取当前用户"""

import random
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.models.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserPublic, TokenResponse
from app.utils.security import hash_password, verify_password, create_access_token, decode_access_token
from app.utils.exceptions import AppException
from app.utils.rate_limit import login_limiter
from app.api.deps import get_current_user

router = APIRouter()

# 验证码 JWT 密钥（与主 JWT 无关，独立使用）
import os as _os
_CAPTCHA_SECRET = _os.environ.get("CAPTCHA_SECRET", "captcha-secret-change-me")
_CAPTCHA_ALGORITHM = "HS256"


class CaptchaResponse(BaseModel):
    question: str
    captcha_token: str = Field(..., description="JWT 编码的答案，5分钟有效")


@router.get("/captcha", response_model=CaptchaResponse)
def get_captcha():
    """生成数学验证码 — 返回算数题 + JWT token（5分钟有效）"""
    a = random.randint(1, 20)
    b = random.randint(1, 20)
    ops = ["+", "-", "×"]
    op_map = {"+": a + b, "-": max(a, b) - min(a, b), "×": a * b}
    op = random.choice(ops)

    if op == "-":
        # 确保被减数 ≥ 减数，结果自然数
        a, b = max(a, b), min(a, b)

    answer = op_map[op]
    question = f"{a} {op} {b} = ?"

    from jose import jwt as captcha_jwt
    from datetime import datetime, timedelta, timezone
    token = captcha_jwt.encode(
        {"answer": answer, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        _CAPTCHA_SECRET,
        algorithm=_CAPTCHA_ALGORITHM,
    )
    return CaptchaResponse(question=question, captcha_token=token)


@router.post("/register", response_model=TokenResponse)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """用户注册"""
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise AppException("用户名已存在")

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        nickname=req.nickname or req.username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


class UserLoginRequestWithCaptcha(UserLoginRequest):
    captcha_token: str = Field(default="")
    captcha_answer: str = Field(default="")


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    req: UserLoginRequestWithCaptcha,
    db: Session = Depends(get_db),
):
    """用户登录 — JSON body (rate-limited: 5 attempts/minute per IP + 验证码)"""
    client_ip = request.client.host if request.client else "unknown"

    if not login_limiter.is_allowed(client_ip):
        raise AppException("登录尝试过于频繁，请稍后再试", code=429)

    # 验证码校验（仅当提供 captcha_token 时校验，保留向后兼容）
    if req.captcha_token:
        try:
            from jose import jwt as captcha_jwt
            payload = captcha_jwt.decode(req.captcha_token, _CAPTCHA_SECRET, algorithms=[_CAPTCHA_ALGORITHM])
            expected_answer = str(payload.get("answer", ""))
            if req.captcha_answer.strip() != expected_answer:
                login_limiter.record_attempt(client_ip)
                raise AppException("验证码错误，请重新输入", code=400)
        except AppException:
            raise
        except Exception:
            login_limiter.record_attempt(client_ip)
            raise AppException("验证码已过期，请刷新后重新输入", code=400)

    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        login_limiter.record_attempt(client_ip)
        raise AppException("用户名或密码错误", code=401)

    login_limiter.reset(client_ip)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return UserPublic.model_validate(current_user)
