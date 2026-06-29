"""模块② AI非遗文创生成 API"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.user import User
from app.models.generation import GeneratedWork
from app.schemas.generation import (
    TextToImageRequest, GenerationResponse, GenerationListItem, PublishRequest,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.api.deps import get_current_user, get_optional_user
from app.utils.exceptions import AppException

logger = logging.getLogger("generation_api")
router = APIRouter()


@router.post("/text-to-image", response_model=GenerationResponse)
def create_text_to_image(
    req: TextToImageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """文生图"""
    from app.services.ai.prompt_builder import build_creation_prompt, build_negative_prompt
    from app.services.ai.image_gen import text_to_image

    # 组装 prompt
    full_prompt = build_creation_prompt(
        base_style=req.base_style,
        elements=req.elements,
        color_palette=req.color_palette,
        composition=req.composition,
        intensity=req.intensity,
    )
    negative = build_negative_prompt(req.negative_prompt)

    # 调用生图
    result = text_to_image(
        prompt=full_prompt,
        negative_prompt=negative,
        count=req.count,
    )

    # 存入数据库
    work = GeneratedWork(
        user_id=current_user.id,
        prompt=full_prompt,
        negative_prompt=negative,
        base_style=req.base_style,
        elements_json=json.dumps(req.elements, ensure_ascii=False),
        color_palette=req.color_palette,
        composition=req.composition,
        intensity=req.intensity,
        seed=result.get("seed"),
        mode="text2img",
        images_json=json.dumps(result["images"], ensure_ascii=False),
        params_json=json.dumps(req.model_dump(), ensure_ascii=False),
    )
    db.add(work)
    db.commit()
    db.refresh(work)

    # 触发护照印章检查 (fire-and-forget)
    _trigger_stamp_check(current_user.id, "generation", db)

    # 触发兴趣画像更新 (fire-and-forget)
    from app.services.ai.recommendation import trigger_profile_update
    trigger_profile_update(current_user.id, "generation", {
        "category": req.base_style,
    })

    # 奖励修习 XP (fire-and-forget)
    from app.services.cultivation_service import award_xp
    award_xp(current_user.id, "创作", 15)

    return GenerationResponse(
        id=work.id,
        images=result["images"],
        params=req.model_dump(),
        seed=result.get("seed"),
        prompt_used=full_prompt,
        created_at=work.created_at,
    )


@router.post("/image-to-image", response_model=GenerationResponse)
async def create_image_to_image(
    file: UploadFile = File(...),
    base_style: str = Form(...),
    elements: str = Form(default=""),
    color_palette: str = Form(default=""),
    composition: str = Form(default=""),
    intensity: float = Form(default=0.7),
    negative_prompt: str = Form(default=""),
    count: int = Form(default=2),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """图生图"""
    from app.services.ai.prompt_builder import build_creation_prompt, build_negative_prompt
    from app.services.ai.image_gen import image_to_image
    from app.config import IMAGE_DIR, MAX_UPLOAD_SIZE_BYTES, ALLOWED_IMAGE_FORMATS, MIN_IMAGE_DIMENSION
    import uuid

    # 校验参考图
    _validate_generation_file(file)

    # 解析 elements JSON
    elements_list = json.loads(elements) if elements else []

    # 保存参考图
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    ref_filename = f"ref_{uuid.uuid4().hex}{ext}"
    ref_path = IMAGE_DIR / ref_filename
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    with open(ref_path, "wb") as f:
        f.write(await file.read())

    # 组装 prompt
    full_prompt = build_creation_prompt(
        base_style=base_style,
        elements=elements_list,
        color_palette=color_palette,
        composition=composition,
        intensity=intensity,
    )
    negative = build_negative_prompt(negative_prompt)

    # 调用图生图
    result = image_to_image(
        ref_image_path=str(ref_path),
        prompt=full_prompt,
        negative_prompt=negative,
        count=count,
    )

    # 存入数据库
    work = GeneratedWork(
        user_id=current_user.id,
        prompt=full_prompt,
        negative_prompt=negative,
        base_style=base_style,
        elements_json=json.dumps(elements_list, ensure_ascii=False),
        color_palette=color_palette,
        composition=composition,
        intensity=intensity,
        seed=result.get("seed"),
        mode="img2img",
        ref_image_path=str(ref_path),
        images_json=json.dumps(result["images"], ensure_ascii=False),
        params_json=json.dumps({
            "base_style": base_style, "elements": elements_list,
            "color_palette": color_palette, "composition": composition,
            "intensity": intensity,
        }, ensure_ascii=False),
    )
    db.add(work)
    db.commit()
    db.refresh(work)

    # 触发护照印章检查 (fire-and-forget)
    _trigger_stamp_check(current_user.id, "generation", db)

    # 触发兴趣画像更新 (fire-and-forget)
    from app.services.ai.recommendation import trigger_profile_update
    trigger_profile_update(current_user.id, "generation", {
        "category": base_style,
    })

    # 奖励修习 XP (fire-and-forget)
    from app.services.cultivation_service import award_xp
    award_xp(current_user.id, "创作", 15)

    return GenerationResponse(
        id=work.id,
        images=result["images"],
        params={"base_style": base_style, "elements": elements_list},
        seed=result.get("seed"),
        prompt_used=full_prompt,
        created_at=work.created_at,
    )


@router.get("/history", response_model=PaginatedResponse[GenerationListItem])
def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户个人生成历史"""
    total = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == current_user.id
    ).count()

    works = db.query(GeneratedWork).filter(
        GeneratedWork.user_id == current_user.id
    ).order_by(desc(GeneratedWork.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [
        GenerationListItem(
            id=w.id,
            images=json.loads(w.images_json) if w.images_json else [],
            base_style=w.base_style,
            prompt=w.prompt,
            is_public=w.is_public,
            created_at=w.created_at,
        )
        for w in works
    ]

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, pages=total_pages)


@router.get("/gallery", response_model=PaginatedResponse[GenerationListItem])
def get_gallery(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """公开作品画廊"""
    total = db.query(GeneratedWork).filter(GeneratedWork.is_public == True).count()

    works = db.query(GeneratedWork).filter(
        GeneratedWork.is_public == True
    ).order_by(desc(GeneratedWork.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [
        GenerationListItem(
            id=w.id,
            images=json.loads(w.images_json) if w.images_json else [],
            base_style=w.base_style,
            prompt=w.prompt,
            is_public=True,
            created_at=w.created_at,
        )
        for w in works
    ]

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(items=items, total=total, page=page, pages=total_pages)


@router.post("/{work_id}/publish", response_model=MessageResponse)
def publish_work(
    work_id: int,
    req: PublishRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发布/取消发布作品到公开画廊"""
    work = db.query(GeneratedWork).filter(
        GeneratedWork.id == work_id,
        GeneratedWork.user_id == current_user.id,
    ).first()
    if not work:
        raise AppException("作品不存在", code=404)

    work.is_public = req.is_public
    db.commit()
    return MessageResponse(message="已发布" if req.is_public else "已取消发布")


@router.delete("/{work_id}", response_model=MessageResponse)
def delete_work(
    work_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除作品"""
    work = db.query(GeneratedWork).filter(
        GeneratedWork.id == work_id,
        GeneratedWork.user_id == current_user.id,
    ).first()
    if not work:
        raise AppException("作品不存在", code=404)

    db.delete(work)
    db.commit()
    return MessageResponse(message="已删除")


# === 文件校验 ===

def _validate_generation_file(file: UploadFile):
    """校验图生图上传文件"""
    from PIL import Image

    if not file.filename:
        raise AppException("未选择文件")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_IMAGE_FORMATS:
        raise AppException(f"不支持的格式: {ext}，请上传 {', '.join(sorted(ALLOWED_IMAGE_FORMATS))}")

    # 读文件大小
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(
            f"文件过大: {file_size / 1024 / 1024:.1f}MB，限制 {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB"
        )

    # PIL校验
    try:
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


def _trigger_stamp_check(user_id: int, module: str, db_session: Session):
    """Fire-and-forget 印章检查"""
    import threading
    from app.models.database import SessionLocal
    from app.services.passport_service import check_and_earn_stamps

    def _earn():
        db = SessionLocal()
        try:
            context = {
                "user_total_count": db.query(GeneratedWork).filter(
                    GeneratedWork.user_id == user_id
                ).count(),
            }
            check_and_earn_stamps(user_id, module, context, db)
        except Exception:
            db.rollback()
        finally:
            db.close()

    threading.Thread(target=_earn, daemon=True).start()
