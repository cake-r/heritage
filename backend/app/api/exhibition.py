"""模块④ 非遗数字展厅 API"""

import json
import uuid
import logging
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Form, Query, Header, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from PIL import Image

from app.models.database import get_db
from app.models.user import User
from app.models.exhibition import HeritageItem, UserUpload
from app.models.favorite import Favorite
from app.schemas.exhibition import (
    HeritageItemResponse, TechniqueItem, InheritorItem,
    UserUploadRequest, UserUploadResponse,
)
from app.schemas.common import PaginatedResponse
from app.api.deps import get_current_user, get_optional_user
from app.utils.exceptions import AppException
from app.utils.security import create_access_token, decode_access_token
from app.config import (
    IMAGE_DIR, MAX_UPLOAD_SIZE_BYTES, ALLOWED_IMAGE_FORMATS,
    MIN_IMAGE_DIMENSION, EXHIBITION_ADMIN_PASSWORD, SECRET_KEY, ALGORITHM,
)

logger = logging.getLogger("exhibition_api")
router = APIRouter()


# === 文件校验 ===

def _validate_upload_file(file: UploadFile):
    """校验上传文件格式/大小/尺寸"""
    if not file.filename:
        raise AppException("未选择文件")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_IMAGE_FORMATS:
        raise AppException(f"不支持的格式: {ext}，请上传 {', '.join(sorted(ALLOWED_IMAGE_FORMATS))}")

    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(
            f"文件过大: {file_size / 1024 / 1024:.1f}MB，限制 {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB"
        )

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


# === 藏品列表 ===

@router.get("/items", response_model=PaginatedResponse[HeritageItemResponse])
def get_items(
    category: str = Query(default=""),
    region: str = Query(default=""),
    era: str = Query(default=""),
    search: str = Query(default=""),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """非遗藏品分页列表 — 支持按品类/地区/年代筛选 + 关键词搜索（含用户上传）"""
    # === HeritageItem 查询 ===
    hq = db.query(HeritageItem)
    if category:
        hq = hq.filter(HeritageItem.category == category)
    if region:
        hq = hq.filter(HeritageItem.region.like(f"%{region}%"))
    if era:
        hq = hq.filter(HeritageItem.era.like(f"%{era}%"))
    if search:
        hq = hq.filter(or_(
            HeritageItem.name.like(f"%{search}%"),
            HeritageItem.description.like(f"%{search}%"),
        ))
    heritage_items = hq.all()

    # === UserUpload 查询 ===
    uq = db.query(UserUpload)
    if category:
        uq = uq.filter(UserUpload.category == category)
    if region:
        uq = uq.filter(UserUpload.region.like(f"%{region}%"))
    if era:
        uq = uq.filter(UserUpload.era.like(f"%{era}%"))
    if search:
        uq = uq.filter(or_(
            UserUpload.title.like(f"%{search}%"),
            UserUpload.description.like(f"%{search}%"),
        ))
    user_uploads = uq.all()

    # === 合并、排序、分页 ===
    all_items: list[tuple[str, int, HeritageItem | UserUpload]] = []
    for it in heritage_items:
        all_items.append(("heritage", it.id, it))
    for up in user_uploads:
        all_items.append(("upload", up.id, up))

    # 按 created_at 倒序排列（最新的在前）
    all_items.sort(key=lambda x: x[2].created_at or datetime(2000, 1, 1), reverse=True)

    total = len(all_items)
    start = (page - 1) * page_size
    end = start + page_size
    page_items = all_items[start:end]

    # 收藏状态
    fav_set: set[tuple[str, int]] = set()
    if current_user:
        favs = db.query(Favorite).filter(
            Favorite.user_id == current_user.id,
        ).all()
        fav_set = {(f.item_type, f.item_id) for f in favs}

    results = []
    for item_type, item_id, item in page_items:
        if item_type == "heritage":
            is_fav = ("heritage", item_id) in fav_set
            results.append(_build_item_response(item, is_fav))
        else:
            is_fav = ("user_upload", item_id) in fav_set
            results.append(_build_upload_response(item, is_fav))

    total_pages = max(1, (total + page_size - 1) // page_size)

    return PaginatedResponse(items=results, total=total, page=page, pages=total_pages)


# === 藏品详情 ===

@router.get("/items/{item_id}", response_model=HeritageItemResponse)
def get_item_detail(
    item_id: int,
    type: str = Query(default="heritage"),
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """非遗藏品详情（含用户上传）。type=heritage|user_upload"""
    if type == "user_upload":
        upload = db.query(UserUpload).filter(UserUpload.id == item_id).first()
        if upload:
            is_fav = False
            if current_user:
                fav = db.query(Favorite).filter(
                    Favorite.user_id == current_user.id,
                    Favorite.item_type == "user_upload",
                    Favorite.item_id == item_id,
                ).first()
                is_fav = fav is not None
            return _build_upload_response(upload, is_fav)
    else:
        item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
        if item:
            is_fav = False
            if current_user:
                fav = db.query(Favorite).filter(
                    Favorite.user_id == current_user.id,
                    Favorite.item_type == "heritage",
                    Favorite.item_id == item_id,
                ).first()
                is_fav = fav is not None
            return _build_item_response(item, is_fav)

    raise AppException("藏品不存在", code=404)


# === 品类列表 ===

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """获取所有非遗品类（含用户上传的品类）"""
    h = db.query(HeritageItem.category).distinct().all()
    u = db.query(UserUpload.category).filter(UserUpload.category.isnot(None)).filter(UserUpload.category != "").distinct().all()
    cats = sorted(set(r[0] for r in h + u if r[0]))
    return cats


@router.get("/regions")
def get_regions(db: Session = Depends(get_db)):
    """获取所有地区（含用户上传的地区）"""
    h = db.query(HeritageItem.region).filter(HeritageItem.region.isnot(None)).filter(HeritageItem.region != "").distinct().all()
    u = db.query(UserUpload.region).filter(UserUpload.region.isnot(None)).filter(UserUpload.region != "").distinct().all()
    regions = sorted(set(r[0] for r in h + u if r[0]))
    return regions


@router.get("/eras")
def get_eras(db: Session = Depends(get_db)):
    """获取所有年代（含用户上传的年代）"""
    h = db.query(HeritageItem.era).filter(HeritageItem.era.isnot(None)).filter(HeritageItem.era != "").distinct().all()
    u = db.query(UserUpload.era).filter(UserUpload.era.isnot(None)).filter(UserUpload.era != "").distinct().all()
    eras = sorted(set(r[0] for r in h + u if r[0]))
    return eras


# === 用户上传作品 ===

@router.post("/uploads", response_model=UserUploadResponse)
async def upload_work(
    images: list[UploadFile] = File(..., max_length=5),
    title: str = Form(...),
    description: str = Form(default=""),
    category: str = Form(default=""),
    region: str = Form(default=""),
    era: str = Form(default=""),
    techniques: str = Form(default="[]"),
    inheritors: str = Form(default="[]"),
    cultural_meaning: str = Form(default=""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户上传非遗作品到展厅"""
    if not title.strip():
        raise AppException("标题不能为空")

    # 解析工艺技法 JSON
    techniques_parsed = []
    try:
        techniques_parsed = json.loads(techniques) if techniques else []
        if not isinstance(techniques_parsed, list):
            techniques_parsed = []
    except (json.JSONDecodeError, TypeError):
        techniques_parsed = []

    # 解析传承人 JSON
    inheritors_parsed = []
    try:
        inheritors_parsed = json.loads(inheritors) if inheritors else []
        if not isinstance(inheritors_parsed, list):
            inheritors_parsed = []
    except (json.JSONDecodeError, TypeError):
        inheritors_parsed = []

    image_paths = []
    for file in images[:5]:  # 最多5张
        if not file.filename:
            continue

        _validate_upload_file(file)

        ext = Path(file.filename).suffix.lower() or ".jpg"
        filename = f"upload_{uuid.uuid4().hex}{ext}"
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
        file_path = IMAGE_DIR / filename

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        image_paths.append(f"/static/images/{filename}")

    if not image_paths:
        raise AppException("至少需要上传一张图片")

    upload = UserUpload(
        user_id=current_user.id,
        title=title.strip(),
        description=description.strip(),
        images_json=json.dumps(image_paths, ensure_ascii=False),
        category=category.strip() or None,
        region=region.strip() or None,
        era=era.strip() or None,
        techniques_json=json.dumps(techniques_parsed, ensure_ascii=False) if techniques_parsed else None,
        inheritors_json=json.dumps(inheritors_parsed, ensure_ascii=False) if inheritors_parsed else None,
        cultural_meaning=cultural_meaning.strip() or None,
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    return UserUploadResponse(
        id=upload.id,
        title=upload.title,
        description=upload.description,
        images=image_paths,
        category=upload.category,
        region=upload.region,
        era=upload.era,
        techniques=techniques_parsed,
        inheritors=inheritors_parsed,
        cultural_meaning=upload.cultural_meaning,
        user_id=upload.user_id,
        created_at=upload.created_at,
    )


# === 管理员功能 ===

def _verify_admin_token(x_admin_token: str | None) -> bool:
    """验证展厅管理员 token"""
    if not x_admin_token:
        return False
    payload = decode_access_token(x_admin_token)
    if not payload:
        return False
    return payload.get("sub") == "exhibition_admin"


@router.post("/admin-verify")
async def verify_admin_password(request: Request):
    """验证展厅管理员密码，返回 admin token"""
    body = await request.json()
    password = body.get("password", "")
    if password != EXHIBITION_ADMIN_PASSWORD:
        raise AppException("密码错误", code=403)

    # 生成管理员 token（24小时有效）
    from jose import jwt
    expire = datetime.utcnow() + timedelta(hours=24)
    payload = {
        "sub": "exhibition_admin",
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"token": token, "message": "验证成功"}


@router.put("/items/{item_id}", response_model=HeritageItemResponse)
async def update_heritage_item(
    item_id: int,
    request: Request,
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """管理员更新非遗项目信息"""
    if not _verify_admin_token(x_admin_token):
        raise AppException("需要管理员权限", code=403)

    body = await request.json()

    item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
    if not item:
        raise AppException("非遗项目不存在", code=404)

    # 更新文本字段
    if "name" in body:
        item.name = body["name"]
    if "category" in body:
        item.category = body["category"]
    if "region" in body:
        item.region = body["region"]
    if "era" in body:
        item.era = body["era"]
    if "description" in body:
        item.description = body["description"]
    if "cultural_meaning" in body:
        item.cultural_meaning = body["cultural_meaning"]

    # 更新技法 JSON
    if "techniques" in body:
        techniques = body["techniques"]
        if isinstance(techniques, list):
            item.techniques_json = json.dumps(techniques, ensure_ascii=False)

    # 更新传承人 JSON
    if "inheritors" in body:
        inheritors = body["inheritors"]
        if isinstance(inheritors, list):
            item.inheritors_json = json.dumps(inheritors, ensure_ascii=False)

    db.commit()
    db.refresh(item)

    logger.info(f"管理员更新非遗项目: id={item.id}, name={item.name}")
    return _build_item_response(item, False)


@router.post("/items/{item_id}/images")
async def upload_heritage_images(
    item_id: int,
    images: list[UploadFile] = File(..., max_length=5),
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """管理员替换非遗项目图片"""
    if not _verify_admin_token(x_admin_token):
        raise AppException("需要管理员权限", code=403)

    item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
    if not item:
        raise AppException("非遗项目不存在", code=404)

    saved = []
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    for img in images:
        if not img.filename:
            continue
        try:
            _validate_upload_file(img)
        except AppException:
            continue

        ext = Path(img.filename).suffix.lower() or ".jpg"
        filename = f"heritage_{item_id}_{uuid.uuid4().hex[:8]}{ext}"
        filepath = IMAGE_DIR / filename
        content = await img.read()
        if len(content) < 1000:
            continue
        filepath.write_bytes(content)
        saved.append(f"/static/images/{filename}")

    if saved:
        item.images_json = json.dumps(saved, ensure_ascii=False)
        db.commit()
        logger.info(f"管理员更新非遗图片: id={item.id}, images={len(saved)}")
    else:
        # 保留旧图片
        pass

    images_list = json.loads(item.images_json) if item.images_json else []
    return {"images": images_list, "message": f"已更新 {len(saved)} 张图片"}


# === 内部工具 ===

def _build_item_response(item: HeritageItem, is_favorited: bool) -> HeritageItemResponse:
    """将 HeritageItem 模型转为响应"""
    techniques = []
    if item.techniques_json:
        try:
            raw = json.loads(item.techniques_json)
            techniques = [TechniqueItem(**t) for t in raw]
        except (json.JSONDecodeError, TypeError):
            pass

    inheritors = []
    if item.inheritors_json:
        try:
            raw = json.loads(item.inheritors_json)
            inheritors = [InheritorItem(**i) for i in raw]
        except (json.JSONDecodeError, TypeError):
            pass

    images = []
    if item.images_json:
        try:
            images = json.loads(item.images_json)
        except (json.JSONDecodeError, TypeError):
            pass

    return HeritageItemResponse(
        id=item.id,
        name=item.name,
        category=item.category,
        region=item.region,
        era=item.era,
        description=item.description,
        techniques=techniques,
        inheritors=inheritors,
        images=images,
        cultural_meaning=item.cultural_meaning,
        is_favorited=is_favorited,
        item_type="heritage",
        created_at=item.created_at,
    )


def _build_upload_response(upload: UserUpload, is_favorited: bool) -> HeritageItemResponse:
    """将 UserUpload 模型转为 HeritageItemResponse"""
    techniques = []
    if upload.techniques_json:
        try:
            raw = json.loads(upload.techniques_json)
            techniques = [TechniqueItem(**t) for t in raw]
        except (json.JSONDecodeError, TypeError):
            pass

    inheritors = []
    if upload.inheritors_json:
        try:
            raw = json.loads(upload.inheritors_json)
            inheritors = [InheritorItem(**i) for i in raw]
        except (json.JSONDecodeError, TypeError):
            pass

    images = []
    if upload.images_json:
        try:
            images = json.loads(upload.images_json)
        except (json.JSONDecodeError, TypeError):
            pass

    return HeritageItemResponse(
        id=upload.id,
        name=upload.title,
        category=upload.category or "",
        region=upload.region,
        era=upload.era,
        description=upload.description,
        techniques=techniques,
        inheritors=inheritors,
        images=images,
        cultural_meaning=upload.cultural_meaning,
        is_favorited=is_favorited,
        item_type="user_upload",
        created_at=upload.created_at,
    )
