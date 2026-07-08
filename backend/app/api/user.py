"""模块⑥ 个人中心 API"""

import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.user import User
from app.config import UPLOAD_DIR, ALLOWED_IMAGE_FORMATS, MAX_UPLOAD_SIZE_BYTES, MIN_IMAGE_DIMENSION
from app.models.recognition import RecognitionRecord
from app.models.generation import GeneratedWork
from app.models.chat import ChatSession
from app.models.exhibition import HeritageItem, UserUpload
from app.models.favorite import Favorite, UserSettings
from app.models.passport import PassportStamp
from app.models.restoration import RestorationRecord
from app.schemas.user import (
    UserProfileResponse, UserProfileUpdate, FavoriteCreate,
    FavoriteItem, UserStatistics,
)
from app.schemas.common import MessageResponse
from app.api.deps import get_current_user
from app.utils.exceptions import AppException

logger = logging.getLogger("user_api")
router = APIRouter()


# === 个人资料 ===

@router.get("/profile", response_model=UserProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取个人资料"""
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        avatar_url=current_user.avatar_url,
        voice_speed=settings.voice_speed if settings else 1.0,
        theme=settings.theme if settings else "light",
        created_at=current_user.created_at,
    )


@router.put("/profile", response_model=UserProfileResponse)
def update_profile(
    req: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新个人资料"""
    if req.nickname:
        current_user.nickname = req.nickname
    if req.avatar_url:
        current_user.avatar_url = req.avatar_url

    db.commit()
    db.refresh(current_user)

    # 获取 settings
    settings = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        nickname=current_user.nickname,
        avatar_url=current_user.avatar_url,
        voice_speed=settings.voice_speed if settings else 1.0,
        theme=settings.theme if settings else "light",
        created_at=current_user.created_at,
    )


# === 头像上传 ===

@router.post("/upload-avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """上传头像图片 → 返回可访问的 URL"""
    # 校验文件
    if not file.filename:
        raise AppException("未选择文件")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_IMAGE_FORMATS:
        raise AppException(f"不支持的格式: {ext}，请上传 {', '.join(sorted(ALLOWED_IMAGE_FORMATS))}")

    # 校验大小
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(f"文件过大: {file_size / 1024 / 1024:.1f}MB，限制 {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB")

    # PIL 校验尺寸
    try:
        from PIL import Image
        file.file.seek(0)
        img = Image.open(file.file)
        w, h = img.size
        file.file.seek(0)
        if w < MIN_IMAGE_DIMENSION or h < MIN_IMAGE_DIMENSION:
            raise AppException(f"图片尺寸过小: {w}x{h}px，最小 {MIN_IMAGE_DIMENSION}px")
    except AppException:
        raise
    except Exception:
        raise AppException("无法解析图片文件，请确认上传的是有效的图片")

    # 保存到 avatars 子目录
    avatars_dir = UPLOAD_DIR / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = avatars_dir / filename

    with open(file_path, "wb") as f:
        f.write(file.file.read())

    url = f"/static/avatars/{filename}"
    logger.info(f"头像上传成功: user={current_user.id}, url={url}")
    return {"url": url}


# === 收藏 ===

@router.post("/favorites", response_model=MessageResponse)
def add_favorite(
    req: FavoriteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """添加收藏"""
    # 检查是否已收藏
    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.item_type == req.item_type,
        Favorite.item_id == req.item_id,
    ).first()
    if existing:
        raise AppException("已收藏过该项目")

    fav = Favorite(
        user_id=current_user.id,
        item_type=req.item_type,
        item_id=req.item_id,
    )
    db.add(fav)
    db.commit()

    # 触发兴趣画像更新 (fire-and-forget)
    from app.services.ai.recommendation import trigger_profile_update
    _fav_data = _resolve_favorite_item(fav, db)
    trigger_profile_update(current_user.id, "favorite", {
        "category": _fav_data.get("category", "") if _fav_data else "",
    })

    return MessageResponse(message="已收藏")


@router.get("/favorites", response_model=list[FavoriteItem])
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取收藏列表 — 解析后的完整信息"""
    favs = db.query(Favorite).filter(
        Favorite.user_id == current_user.id
    ).order_by(Favorite.created_at.desc()).all()

    result = []
    for fav in favs:
        item_data = _resolve_favorite_item(fav, db)
        result.append(FavoriteItem(
            id=fav.id,
            item_type=fav.item_type,
            item_id=fav.item_id,
            title=item_data.get("title", "(已删除)") if item_data else "(已删除)",
            image_url=item_data.get("image_url", "") if item_data else "",
            category=item_data.get("category", "") if item_data else "",
            creator=item_data.get("creator", "") if item_data else "",
            created_at=item_data.get("created_at") if item_data else fav.created_at,
        ))

    return result


@router.delete("/favorites/{favorite_id}", response_model=MessageResponse)
def delete_favorite(
    favorite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """取消收藏"""
    fav = db.query(Favorite).filter(
        Favorite.id == favorite_id,
        Favorite.user_id == current_user.id,
    ).first()
    if not fav:
        raise AppException("收藏不存在", code=404)

    # 获取收藏数据用于画像更新（在删除前获取）
    _fav_data = _resolve_favorite_item(fav, db)

    db.delete(fav)
    db.commit()

    # 触发兴趣画像更新 (fire-and-forget)
    from app.services.ai.recommendation import trigger_profile_update
    trigger_profile_update(current_user.id, "favorite", {
        "category": _fav_data.get("category", "") if _fav_data else "",
    })

    return MessageResponse(message="已取消收藏")


# === 统计数据 ===

@router.get("/statistics", response_model=UserStatistics)
def get_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户统计数据"""
    user_id = current_user.id

    return UserStatistics(
        recognition_count=db.query(RecognitionRecord).filter(
            RecognitionRecord.user_id == user_id
        ).count(),
        generation_count=db.query(GeneratedWork).filter(
            GeneratedWork.user_id == user_id
        ).count(),
        chat_count=db.query(ChatSession).filter(
            ChatSession.user_id == user_id
        ).count(),
        favorite_count=db.query(Favorite).filter(
            Favorite.user_id == user_id
        ).count(),
        upload_count=db.query(UserUpload).filter(
            UserUpload.user_id == user_id
        ).count(),
        passport_stamp_count=db.query(PassportStamp).filter(
            PassportStamp.user_id == user_id
        ).count(),
        restoration_count=db.query(RestorationRecord).filter(
            RestorationRecord.user_id == user_id
        ).count(),
    )


# === 内部工具 ===

def _resolve_favorite_item(fav: Favorite, db: Session) -> dict | None:
    """将收藏记录解析为可展示的完整信息"""
    item_type = fav.item_type
    item_id = fav.item_id

    if item_type == "heritage":
        item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
        if not item:
            return None
        images = json.loads(item.images_json) if item.images_json else []
        return {
            "title": item.name,
            "image_url": images[0] if images else "",
            "category": item.category,
            "creator": "",
            "created_at": item.created_at,
        }

    elif item_type == "generated":
        work = db.query(GeneratedWork).filter(GeneratedWork.id == item_id).first()
        if not work:
            return None
        images = json.loads(work.images_json) if work.images_json else []
        return {
            "title": f"{work.base_style}风格文创",
            "image_url": images[0] if images else "",
            "category": work.base_style,
            "creator": "",
            "created_at": work.created_at,
        }

    elif item_type == "user_upload":
        upload = db.query(UserUpload).filter(UserUpload.id == item_id).first()
        if not upload:
            return None
        images = json.loads(upload.images_json) if upload.images_json else []
        # 获取上传者昵称
        uploader = db.query(User).filter(User.id == upload.user_id).first()
        return {
            "title": upload.title,
            "image_url": images[0] if images else "",
            "category": upload.category or "",
            "creator": uploader.nickname if uploader else "",
            "created_at": upload.created_at,
        }

    return None
