"""鉴权API — 注册/登录/获取当前用户"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, UserPublic, TokenResponse
from app.utils.security import hash_password, verify_password, create_access_token
from app.utils.exceptions import AppException
from app.utils.rate_limit import login_limiter
from app.api.deps import get_current_user

router = APIRouter()


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


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    req: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """用户登录 — JSON body (rate-limited: 5 attempts/minute per IP)"""
    client_ip = request.client.host if request.client else "unknown"

    if not login_limiter.is_allowed(client_ip):
        raise AppException("登录尝试过于频繁，请稍后再试", code=429)

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
