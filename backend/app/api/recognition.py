"""模块① 非遗智能识别与讲解 API"""

import json
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.user import User
from app.models.recognition import RecognitionRecord
from app.models.exhibition import HeritageItem
from app.schemas.recognition import (
    RecognitionResponse, RecognitionListItem,
    CategoryCandidate, Explanation, RelatedRecommendations,
    CreationLink, ExhibitLink, HeatmapFeature,
)
from app.schemas.common import PaginatedResponse
from app.api.deps import get_current_user
from app.config import IMAGE_DIR, MAX_UPLOAD_SIZE_BYTES, ALLOWED_IMAGE_FORMATS, MIN_IMAGE_DIMENSION
from app.utils.exceptions import AppException

logger = logging.getLogger("recognition_api")

router = APIRouter()


@router.post("/upload", response_model=RecognitionResponse)
def upload_and_recognize(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传非遗图片 → 识别品类 → 生成讲解 → 语音合成"""

    # 1. 校验文件
    _validate_file(file)

    # 2. 保存图片
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    image_path = IMAGE_DIR / filename

    with open(image_path, "wb") as f:
        f.write(file.file.read())

    # 3. 调用AI识别
    from app.services.ai.recognition import recognize, UNKNOWN_CATEGORY
    rec_result = recognize(str(image_path))

    # 3.5 生成热力图 (无法识别时跳过)
    heatmap_url = None
    heatmap_data = []
    if rec_result["category"] != UNKNOWN_CATEGORY:
        from app.services.ai.post_process import generate_heatmap
        try:
            heatmap_url, heatmap_data = generate_heatmap(
                str(image_path),
                rec_result.get("features", []),
                rec_result["category"],
            )
        except Exception as e:
            logger.warning(f"热力图生成失败: {e}")

    # 4. 调用LLM生成讲解 (无法识别时使用提示信息)
    from app.services.ai.llm import generate_explanation
    explanation = generate_explanation(
        rec_result["category"],
        rec_result["features"],
        rec_result.get("raw_description", ""),
    )

    # 5. 调用TTS合成语音 (无法识别时跳过)
    voice_url = None
    if rec_result["category"] != UNKNOWN_CATEGORY:
        from app.services.ai.tts import synthesize
        voice_text = f"{rec_result['category']}。{explanation['history'][:200]}"
        try:
            voice_url = synthesize(voice_text)
        except Exception as e:
            logger.warning(f"TTS合成失败: {e}")

    # 6. 查询关联推荐 (无法识别时返回空)
    related = _get_related(rec_result["category"], db) if rec_result["category"] != UNKNOWN_CATEGORY else _empty_related()

    # 7. 存入数据库
    record = RecognitionRecord(
        user_id=current_user.id,
        image_path=str(image_path),
        category=rec_result["category"],
        confidence=rec_result["confidence"],
        top3_json=json.dumps(rec_result.get("top3", []), ensure_ascii=False),
        features_json=json.dumps(rec_result.get("features", []), ensure_ascii=False),
        explanation_json=json.dumps(explanation, ensure_ascii=False),
        raw_response_json=json.dumps(rec_result, ensure_ascii=False),
        heatmap_path=heatmap_url,
        voice_path=voice_url,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # 9. 触发护照印章检查 (fire-and-forget)
    _trigger_stamp_check(current_user.id, "recognition", rec_result, db)

    # 10. 触发兴趣画像更新 (fire-and-forget)
    from app.services.ai.recommendation import trigger_profile_update
    trigger_profile_update(current_user.id, "recognition", {
        "category": rec_result.get("category", ""),
        "confidence": rec_result.get("confidence", 0.0),
    })

    # 11. 奖励修习 XP (fire-and-forget)
    from app.services.cultivation_service import award_xp
    award_xp(current_user.id, "鉴宝", 10)

    # 8. 构建响应
    return _build_response(record, voice_url, related, heatmap_data)


@router.get("/history", response_model=PaginatedResponse[RecognitionListItem])
def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的识别历史"""
    total = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == current_user.id
    ).count()

    records = db.query(RecognitionRecord).filter(
        RecognitionRecord.user_id == current_user.id
    ).order_by(desc(RecognitionRecord.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [
        RecognitionListItem(
            id=r.id,
            image_url=f"/static/images/{Path(r.image_path).name}",
            category=r.category,
            confidence=r.confidence,
            created_at=r.created_at,
        )
        for r in records
    ]

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        pages=total_pages,
    )


@router.get("/{record_id}", response_model=RecognitionResponse)
def get_detail(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单条识别记录详情"""
    record = db.query(RecognitionRecord).filter(
        RecognitionRecord.id == record_id,
        RecognitionRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise AppException("识别记录不存在", code=404)

    related = _get_related(record.category, db)
    return _build_response(record, record.voice_path, related)


# === 内部工具函数 ===

def _validate_file(file: UploadFile):
    """校验上传文件"""
    if not file.filename:
        raise AppException("未选择文件")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_IMAGE_FORMATS:
        raise AppException(f"不支持的格式: {ext}, 请上传 {', '.join(ALLOWED_IMAGE_FORMATS)}")

    # 读尺寸
    file.file.seek(0, 2)  # seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # reset

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(f"文件过大: {file_size / 1024 / 1024:.1f}MB, 限制 {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB")

    # PIL校验尺寸
    try:
        from PIL import Image
        file.file.seek(0)
        img = Image.open(file.file)
        w, h = img.size
        file.file.seek(0)
        if w < MIN_IMAGE_DIMENSION or h < MIN_IMAGE_DIMENSION:
            raise AppException(f"图片尺寸过小: {w}x{h}px, 最小 {MIN_IMAGE_DIMENSION}px")
    except AppException:
        raise
    except Exception:
        raise AppException("无法解析图片文件，请确认上传的是有效的图片")


def _empty_related() -> RelatedRecommendations:
    """返回空的关联推荐"""
    return RelatedRecommendations(creations=[], exhibits=[])


def _get_related(category: str, db: Session) -> RelatedRecommendations:
    """查询关联推荐: 同品类文创模板 + 展厅藏品"""
    # 创意推荐
    creation_links = [
        CreationLink(style=category, label=f"试试{category}风格的文创生成"),
        CreationLink(style="剪纸", label="试试剪纸风格的文创生成"),
    ]

    # 展厅推荐
    exhibits = db.query(HeritageItem).filter(
        HeritageItem.category == category
    ).limit(3).all()
    exhibit_links = [ExhibitLink(id=e.id, name=e.name) for e in exhibits]

    return RelatedRecommendations(creations=creation_links, exhibits=exhibit_links)


def _build_response(
    record: RecognitionRecord,
    voice_url: str | None,
    related: RelatedRecommendations,
    heatmap_data: list[dict] | None = None,
) -> RecognitionResponse:
    """将数据库记录转为响应模型"""
    top3 = json.loads(record.top3_json) if record.top3_json else []
    features = json.loads(record.features_json) if record.features_json else []
    explanation = json.loads(record.explanation_json) if record.explanation_json else {
        "history": "", "technique": "", "inheritor": "", "meaning": ""
    }

    return RecognitionResponse(
        id=record.id,
        image_url=f"/static/images/{Path(record.image_path).name}",
        category=record.category,
        confidence=record.confidence,
        top3=[CategoryCandidate(**t) for t in top3],
        features=features,
        explanation=Explanation(**explanation),
        heatmap_url=record.heatmap_path,
        heatmap_data=[HeatmapFeature(**h) for h in (heatmap_data or [])],
        voice_url=voice_url,
        related=related,
        created_at=record.created_at,
    )


def _trigger_stamp_check(user_id: int, module: str, rec_result: dict, db_session: Session):
    """Fire-and-forget 印章检查"""
    import threading
    from app.models.database import SessionLocal
    from app.services.passport_service import check_and_earn_stamps

    def _earn():
        db = SessionLocal()
        try:
            context = {
                "category": rec_result.get("category", ""),
                "confidence": rec_result.get("confidence", 0.0),
                "user_total_count": db.query(RecognitionRecord).filter(
                    RecognitionRecord.user_id == user_id
                ).count(),
            }
            check_and_earn_stamps(user_id, module, context, db)
        except Exception:
            db.rollback()
        finally:
            db.close()

    threading.Thread(target=_earn, daemon=True).start()
