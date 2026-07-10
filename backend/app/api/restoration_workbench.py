"""人机协同数字修复工作台 API — 损伤检测、局部修复、档案管理"""

import json
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.user import User
from app.models.restoration_archive import RestorationArchive
from app.schemas.restoration_workbench import (
    DamageDetectResponse, DamageRegion,
    LocalInpaintRequest, LocalInpaintResponse,
    ArchiveRequest, ArchiveResponse, ArchiveListItem, ArchiveOperation,
)
from app.api.deps import get_current_user
from app.config import IMAGE_DIR, MAX_UPLOAD_SIZE_BYTES, ALLOWED_IMAGE_FORMATS, MIN_IMAGE_DIMENSION
from app.utils.exceptions import AppException

logger = logging.getLogger("restoration_workbench")

router = APIRouter()


# ============================================================
# Damage Detection
# ============================================================

@router.post("/damage-detect", response_model=DamageDetectResponse)
def damage_detect(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """上传文物图片 → Qwen-VL 损伤检测（含 bbox 坐标）→ 返回损伤报告"""
    _validate_file(file)

    # 保存上传图片
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"detect_{uuid.uuid4().hex}{ext}"
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    image_path = IMAGE_DIR / filename

    with open(image_path, "wb") as f:
        f.write(file.file.read())

    image_url = f"/static/images/{filename}"

    # 运行损伤分析（复用 restoration_pipeline 的 Step 1）
    from app.services.ai.restoration_pipeline import _run_damage_analysis

    damage_result = _run_damage_analysis(str(image_path))

    # 构建响应
    regions_raw = damage_result.get("damage_regions", [])
    damage_regions = [
        DamageRegion(
            x=max(0, r.get("x", 0)),
            y=max(0, r.get("y", 0)),
            width=min(r.get("width", 100), 1024),
            height=min(r.get("height", 100), 1024),
            description=r.get("description", ""),
            severity=r.get("severity", "轻度"),
        )
        for r in (regions_raw or [])
    ]

    return DamageDetectResponse(
        category=damage_result.get("category", "非遗工艺品"),
        damage_types=damage_result.get("damage_types", []),
        severity=damage_result.get("severity", "轻度"),
        description=damage_result.get("description", ""),
        damage_regions=damage_regions,
        image_url=image_url,
    )


# ============================================================
# Local Inpaint
# ============================================================

@router.post("/local-inpaint", response_model=LocalInpaintResponse)
def local_inpaint(
    req: LocalInpaintRequest,
    current_user: User = Depends(get_current_user),
):
    """接收裁剪区域 → 局部 AI 修复 → OpenCV 自然融合 → 返回修复图 URL"""
    from app.services.ai.restoration_pipeline import run_local_restoration
    from app.config import IMAGE_DIR as _IMG_DIR

    # 解析图片路径: 支持 /static/... 和绝对路径
    image_path = req.image_path
    if image_path.startswith("/static/"):
        # 将 /static/images/foo.jpg → 本地路径
        relative = image_path.replace("/static/", "")
        image_path = str(Path(_IMG_DIR).parent / relative)

    if not Path(image_path).exists():
        raise AppException(f"图片不存在: {image_path}", code=404)

    # 调用改进后的 local_restoration（含 seamlessClone 融合）
    region = {"x": req.x, "y": req.y, "width": req.width, "height": req.height}
    result = run_local_restoration(image_path, region, feather_radius=req.feather_radius)

    restored_url = result.get("restored_image_url", "") if result else ""

    return LocalInpaintResponse(
        restored_image_url=restored_url,
        crop_restored_url=result.get("restored_image_url", ""),
        region=DamageRegion(
            x=req.x, y=req.y, width=req.width, height=req.height,
            description=f"{req.tool_type} 局部修复",
        ),
    )


# ============================================================
# Archive Management
# ============================================================

@router.post("/archive", response_model=ArchiveResponse)
def save_archive(
    req: ArchiveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建或更新修复档案（upsert: 传 id 则更新）"""
    ops_json = json.dumps(
        [op.model_dump() for op in req.operations],
        ensure_ascii=False,
    )

    # 检查是否更新已有档案
    archive = None

    if archive is None:
        # 创建新档案
        archive = RestorationArchive(
            user_id=current_user.id,
            original_image_path=req.original_image_path,
            damage_report_json=req.damage_report_json,
            operations_json=ops_json,
            ai_assist_ratio=req.ai_assist_ratio,
            final_image_path=req.final_image_path,
            verification_json=req.verification_json,
        )
        db.add(archive)
        db.commit()
        db.refresh(archive)
    else:
        # 更新已有档案
        archive.damage_report_json = req.damage_report_json or archive.damage_report_json
        archive.operations_json = ops_json
        archive.ai_assist_ratio = req.ai_assist_ratio
        archive.final_image_path = req.final_image_path or archive.final_image_path
        archive.verification_json = req.verification_json or archive.verification_json
        db.commit()
        db.refresh(archive)

    return _build_archive_response(archive)


@router.get("/archive/{archive_id}", response_model=ArchiveResponse)
def get_archive(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单条修复档案详情"""
    archive = db.query(RestorationArchive).filter(
        RestorationArchive.id == archive_id,
        RestorationArchive.user_id == current_user.id,
    ).first()

    if not archive:
        raise AppException("修复档案不存在", code=404)

    return _build_archive_response(archive)


@router.get("/archives")
def list_archives(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的修复档案列表"""
    total = db.query(RestorationArchive).filter(
        RestorationArchive.user_id == current_user.id
    ).count()

    archives = db.query(RestorationArchive).filter(
        RestorationArchive.user_id == current_user.id
    ).order_by(desc(RestorationArchive.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [_build_archive_item(a) for a in archives]

    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": total_pages,
    }


# ============================================================
# Internal Utilities
# ============================================================

def _validate_file(file: UploadFile):
    """校验上传文件（与 restoration.py 保持一致）"""
    if not file.filename:
        raise AppException("未选择文件")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_IMAGE_FORMATS:
        raise AppException(f"不支持的格式: {ext}, 请上传 {', '.join(ALLOWED_IMAGE_FORMATS)}")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(f"文件过大: {file_size / 1024 / 1024:.1f}MB, 限制 {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB")

    try:
        from PIL import Image
        file.file.seek(0)
        img = Image.open(file.file)
        w, h = img.size
        file.file.seek(0)
        if w < MIN_IMAGE_DIMENSION or h < MIN_IMAGE_DIMENSION:
            raise AppException(f"图片尺寸过小: {w}x{h}px, 单边最小 {MIN_IMAGE_DIMENSION}px")
    except AppException:
        raise
    except Exception:
        raise AppException("无法解析图片文件，请确认上传的是有效的图片")


def _build_archive_response(archive: RestorationArchive) -> ArchiveResponse:
    """数据库记录 → ArchiveResponse"""
    operations = []
    if archive.operations_json:
        try:
            ops_raw = json.loads(archive.operations_json)
            operations = [ArchiveOperation(**op) for op in ops_raw]
        except (json.JSONDecodeError, TypeError):
            pass

    damage_report = None
    if archive.damage_report_json:
        try:
            damage_report = json.loads(archive.damage_report_json)
        except (json.JSONDecodeError, TypeError):
            pass

    verification = None
    if archive.verification_json:
        try:
            verification = json.loads(archive.verification_json)
        except (json.JSONDecodeError, TypeError):
            pass

    original_url = f"/static/images/{Path(archive.original_image_path).name}" if archive.original_image_path else ""
    final_url = f"/static/images/{Path(archive.final_image_path).name}" if archive.final_image_path else None

    return ArchiveResponse(
        id=archive.id,
        user_id=archive.user_id,
        original_image_url=original_url,
        damage_report=damage_report,
        operations=operations,
        ai_assist_ratio=archive.ai_assist_ratio or 0.0,
        final_image_url=final_url,
        verification=verification,
        export_count=archive.export_count or 0,
        created_at=archive.created_at,
    )


def _build_archive_item(archive: RestorationArchive) -> ArchiveListItem:
    """数据库记录 → ArchiveListItem"""
    original_url = f"/static/images/{Path(archive.original_image_path).name}" if archive.original_image_path else ""
    final_url = f"/static/images/{Path(archive.final_image_path).name}" if archive.final_image_path else None

    return ArchiveListItem(
        id=archive.id,
        original_image_url=original_url,
        final_image_url=final_url,
        ai_assist_ratio=archive.ai_assist_ratio or 0.0,
        export_count=archive.export_count or 0,
        created_at=archive.created_at,
    )
