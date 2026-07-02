"""Admin API — 用户管理"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.database import get_db
from app.models.user import User
from app.api.deps import get_current_admin
from app.schemas.admin import UserRoleUpdate, UserBanRequest
from app.utils.exceptions import AppException

router = APIRouter()


@router.get("/api/admin/users")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    role: str | None = Query(None),
    is_banned: bool | None = Query(None),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """用户列表 (分页 + 搜索 + 筛选)"""
    q = db.query(User)

    if search:
        q = q.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.nickname.ilike(f"%{search}%"))
        )

    if role:
        # role 字段可能尚未存在 (migration 待添加)
        try:
            q = q.filter(User.role == role)
        except Exception:
            pass

    if is_banned is not None:
        try:
            q = q.filter(User.is_banned == is_banned)
        except Exception:
            pass

    total = q.count()
    users = q.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": u.id,
                "username": u.username,
                "nickname": u.nickname,
                "role": getattr(u, "role", "user"),
                "is_banned": getattr(u, "is_banned", False),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
    }


@router.get("/api/admin/users/{user_id}")
def get_user_detail(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """用户详情 + 统计"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppException("用户不存在", code=404)

    # 统计用户行为
    from app.models.recognition import RecognitionRecord
    from app.models.generation import GeneratedWork
    from app.models.cultivation import UserCultivation

    rec_count = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == user_id
    ).count()
    gen_count = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == user_id
    ).count()

    cultivation = db.query(UserCultivation).filter(
        UserCultivation.user_id == user_id
    ).first()

    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "avatar_url": user.avatar_url,
        "role": getattr(user, "role", "user"),
        "is_banned": getattr(user, "is_banned", False),
        "recognition_count": rec_count,
        "generation_count": gen_count,
        "xp_total": cultivation.xp if cultivation else 0,
        "rank": cultivation.rank if cultivation else "初窥门径",
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.put("/api/admin/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: UserRoleUpdate,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """修改用户角色"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppException("用户不存在", code=404)
    if user.id == admin.id:
        raise AppException("不能修改自己的角色", code=400)

    # 如果 role 列尚未添加, 可以通过 _migrate_add_column 的方法处理
    try:
        user.role = body.role
    except Exception:
        from app.models.database import _migrate_add_column, DATABASE_URL
        if "sqlite" in DATABASE_URL:
            raise AppException("role 列不存在，请运行数据库迁移", code=500)
        raise

    db.commit()
    return {"status": "ok", "message": f"已更新用户 {user.username} 角色为 {body.role}"}


@router.post("/api/admin/users/{user_id}/ban")
def ban_user(
    user_id: int,
    body: UserBanRequest = UserBanRequest(),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """封禁用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppException("用户不存在", code=404)
    if user.id == admin.id:
        raise AppException("不能封禁自己", code=400)

    user.is_banned = True
    db.commit()
    return {"status": "ok", "message": f"已封禁用户 {user.username}"}


@router.post("/api/admin/users/{user_id}/unban")
def unban_user(
    user_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """解封用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppException("用户不存在", code=404)

    user.is_banned = False
    db.commit()
    return {"status": "ok", "message": f"已解封用户 {user.username}"}
