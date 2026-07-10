"""文物数字修复 API"""

import json
import os
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.database import get_db
from app.models.user import User
from app.models.restoration import RestorationRecord
from app.schemas.restoration import (
    RestorationResponse, RestorationListItem,
    PipelineStep,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.services.agent.execution_tracker import get_last_execution_id, get_last_execution_steps
from app.api.deps import get_current_user
from app.config import IMAGE_DIR, GENERATED_DIR, MAX_UPLOAD_SIZE_BYTES, ALLOWED_IMAGE_FORMATS, MIN_IMAGE_DIMENSION
from app.utils.exceptions import AppException

logger = logging.getLogger("restoration_api")

router = APIRouter()


@router.post("/upload", response_model=RestorationResponse)
def upload_and_restore(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传文物图片 → 运行4步AI修复管道 → 返回结果"""

    # 1. 校验文件
    _validate_file(file)

    # 2. 保存原始图片
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"restore_{uuid.uuid4().hex}{ext}"
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    image_path = IMAGE_DIR / filename

    with open(image_path, "wb") as f:
        f.write(file.file.read())

    original_image_url = f"/static/images/{filename}"

    # 2.5 I2I 尺寸预检 — 管道运行前第一道关拦截，避免浪费损伤分析/修复方案时间
    from app.services.ai.i2i_utils import validate_i2i_input, I2IDimensionError
    try:
        validate_i2i_input(str(image_path))
    except I2IDimensionError as e:
        # 清理已保存的文件
        try:
            os.remove(image_path)
        except Exception:
            pass
        raise AppException(str(e))

    # 3. 运行修复管道
    from app.services.ai.restoration_pipeline import run_restoration_pipeline
    pipeline_result = run_restoration_pipeline(str(image_path))

    pipeline_steps_raw = pipeline_result["pipeline_steps"]
    restored_image_url = pipeline_result.get("restored_image_url")

    # 4. 提取各步骤结果用于数据库存储
    step1 = pipeline_steps_raw[0] if len(pipeline_steps_raw) > 0 else {}
    step2 = pipeline_steps_raw[1] if len(pipeline_steps_raw) > 1 else {}
    step3 = pipeline_steps_raw[2] if len(pipeline_steps_raw) > 2 else {}
    step4 = pipeline_steps_raw[3] if len(pipeline_steps_raw) > 3 else {}

    damage_result = step1.get("result", {}) if step1.get("status") == "completed" else {}
    prompt_result = step2.get("result", {}) if step2.get("status") == "completed" else {}
    gen_result = step3.get("result", {}) if step3.get("status") == "completed" else {}
    verify_result = step4.get("result", {}) if step4.get("status") == "completed" else {}

    # 判断整体管道状态
    all_completed = all(s.get("status") == "completed" for s in pipeline_steps_raw)
    any_failed = any(s.get("status") == "failed" for s in pipeline_steps_raw)

    if any_failed:
        pipeline_status = "failed"
        pipeline_error = next((s.get("result", {}).get("error", "未知错误")
                               for s in pipeline_steps_raw if s.get("status") == "failed"), "管道执行失败")
    else:
        pipeline_status = "completed"
        pipeline_error = None

    # 5. 存入数据库
    record = RestorationRecord(
        user_id=current_user.id,
        original_image_path=str(image_path),
        damage_category=damage_result.get("category"),
        damage_types_json=json.dumps(damage_result.get("damage_types", []), ensure_ascii=False),
        damage_severity=damage_result.get("severity"),
        damage_description=damage_result.get("description"),
        restoration_prompt=prompt_result.get("prompt"),
        restored_images_json=json.dumps(gen_result.get("images", []), ensure_ascii=False),
        restoration_seed=gen_result.get("seed"),
        verification_score=verify_result.get("overall_score"),
        verification_json=json.dumps(verify_result, ensure_ascii=False),
        pipeline_status=pipeline_status,
        pipeline_error=pipeline_error,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # 6. 触发护照印章检查 (fire-and-forget)
    _trigger_stamp_check(current_user.id, "restoration", record.verification_score or 0, db)

    # 7. 构建响应
    response = _build_response(record, pipeline_steps_raw, restored_image_url)
    response.execution_id = get_last_execution_id()
    response.agent_steps = get_last_execution_steps()
    return response


@router.post("/upload-async")
def upload_and_restore_async(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """上传文物图片 → 提交异步修复任务 → 立即返回 task_id（前端轮询 GET /api/tasks/{task_id}）"""
    from app.services.task_scheduler import submit_task

    # 校验 + 保存文件
    _validate_file(file)
    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"restore_{uuid.uuid4().hex}{ext}"
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    image_path = IMAGE_DIR / filename

    with open(image_path, "wb") as f:
        f.write(file.file.read())

    image_url = f"/static/images/{filename}"

    # I2I 尺寸预检 — 提交任务前第一道关拦截
    from app.services.ai.i2i_utils import validate_i2i_input, I2IDimensionError
    try:
        validate_i2i_input(str(image_path))
    except I2IDimensionError as e:
        try:
            os.remove(image_path)
        except Exception:
            pass
        raise AppException(str(e))

    # 提交异步任务
    task_id = submit_task(
        task_type="restoration",
        user_id=current_user.id,
        payload={"image_url": str(image_path), "image_path": str(image_path)},
    )

    return {
        "task_id": task_id,
        "message": "修复任务已提交，请轮询 GET /api/tasks/{task_id} 获取进度",
        "original_image_url": image_url,
    }


@router.get("/history", response_model=PaginatedResponse[RestorationListItem])
def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的修复历史"""
    total = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == current_user.id
    ).count()

    records = db.query(RestorationRecord).filter(
        RestorationRecord.user_id == current_user.id
    ).order_by(desc(RestorationRecord.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [
        _build_list_item(r)
        for r in records
    ]

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        pages=total_pages,
    )


@router.get("/{record_id}", response_model=RestorationResponse)
def get_detail(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单条修复记录详情"""
    record = db.query(RestorationRecord).filter(
        RestorationRecord.id == record_id,
        RestorationRecord.user_id == current_user.id,
    ).first()

    if not record:
        raise AppException("修复记录不存在", code=404)

    # 从数据库重建管道步骤
    steps = _rebuild_steps(record)
    restored_url = _get_restored_url(record)

    return _build_response(record, steps, restored_url)


@router.delete("/{record_id}", response_model=MessageResponse)
def delete_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除修复记录（同时清理关联的磁盘文件，包括原图与生成的修复图）"""
    record = db.query(RestorationRecord).filter(
        RestorationRecord.id == record_id,
        RestorationRecord.user_id == current_user.id,
    ).first()
    if not record:
        raise AppException("修复记录不存在", code=404)

    # 收集待清理的文件路径
    files_to_clean: list[str] = []
    if record.original_image_path and os.path.exists(record.original_image_path):
        files_to_clean.append(record.original_image_path)

    # 解析 restored_images_json，清理所有生成的修复图
    if record.restored_images_json:
        try:
            images = json.loads(record.restored_images_json)
            for img_url in images:
                fp = GENERATED_DIR / Path(img_url).name
                if os.path.exists(fp):
                    files_to_clean.append(str(fp))
        except (json.JSONDecodeError, TypeError):
            pass

    db.delete(record)
    db.commit()

    # 清理磁盘文件（best-effort）
    for fp in files_to_clean:
        try:
            os.remove(fp)
            logger.info(f"已删除修复记录文件: {fp}")
        except Exception as e:
            logger.warning(f"删除修复记录文件失败: {fp}, {e}")

    return MessageResponse(message="已删除")


# === 内部工具函数 ===

def _validate_file(file: UploadFile):
    """校验上传文件 (与 recognition.py / exhibition.py 保持一致)"""
    if not file.filename:
        raise AppException("未选择文件")

    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in ALLOWED_IMAGE_FORMATS:
        raise AppException(f"不支持的格式: {ext}, 请上传 {', '.join(ALLOWED_IMAGE_FORMATS)}")

    # 读大小
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise AppException(f"文件过大: {file_size / 1024 / 1024:.1f}MB, 限制 {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024:.0f}MB")

    # PIL 校验尺寸
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


def _build_response(
    record: RestorationRecord,
    steps: list[dict],
    restored_image_url: str | None,
) -> RestorationResponse:
    """将数据库记录 + 管道步骤转为响应"""
    return RestorationResponse(
        id=record.id,
        original_image_url=f"/static/images/{Path(record.original_image_path).name}",
        restored_image_url=restored_image_url,
        pipeline_steps=[PipelineStep(**s) for s in steps],
        created_at=record.created_at,
    )


def _build_list_item(record: RestorationRecord) -> RestorationListItem:
    """构建列表项"""
    return RestorationListItem(
        id=record.id,
        original_image_url=f"/static/images/{Path(record.original_image_path).name}",
        restored_image_url=_get_restored_url(record),
        damage_category=record.damage_category,
        verification_score=record.verification_score,
        pipeline_status=record.pipeline_status or "completed",
        created_at=record.created_at,
    )


def _get_restored_url(record: RestorationRecord) -> str | None:
    """从 restored_images_json 提取第一张图片 URL"""
    if record.restored_images_json:
        try:
            images = json.loads(record.restored_images_json)
            if images:
                return images[0]
        except (json.JSONDecodeError, IndexError):
            pass
    return None


def _rebuild_steps(record: RestorationRecord) -> list[dict]:
    """从数据库字段重建4个管道步骤"""
    steps = []

    # Step 1: 损伤分析
    damage_types = []
    if record.damage_types_json:
        try:
            damage_types = json.loads(record.damage_types_json)
        except json.JSONDecodeError:
            pass

    steps.append({
        "step": 1,
        "name": "损伤分析",
        "model": "qwen-vl-max",
        "status": "completed" if record.damage_category else "failed",
        "result": {
            "category": record.damage_category or "",
            "damage_types": damage_types,
            "severity": record.damage_severity or "",
            "description": record.damage_description or "",
        },
    })

    # Step 2: 修复方案
    steps.append({
        "step": 2,
        "name": "修复方案生成",
        "model": "deepseek-chat",
        "status": "completed" if record.restoration_prompt else "failed",
        "result": {
            "prompt": record.restoration_prompt or "",
        },
    })

    # Step 3: 图像修复
    restored_images = []
    if record.restored_images_json:
        try:
            restored_images = json.loads(record.restored_images_json)
        except json.JSONDecodeError:
            pass

    steps.append({
        "step": 3,
        "name": "AI图像修复",
        "model": "wan2.5-i2i-preview",
        "status": "completed" if restored_images else "failed",
        "result": {
            "images": restored_images,
            "seed": record.restoration_seed or 0,
        },
    })

    # Step 4: 修复验证
    verify_data = {}
    if record.verification_json:
        try:
            verify_data = json.loads(record.verification_json)
        except json.JSONDecodeError:
            pass

    steps.append({
        "step": 4,
        "name": "修复验证",
        "model": "qwen-vl-max",
        "status": "completed" if verify_data else "failed",
        "result": verify_data or {},
    })

    return steps


def _trigger_stamp_check(user_id: int, module: str, score: int, db_session: Session):
    """串行写入队列 印章检查（避免多线程竞争 SQLite 写锁）"""
    from app.models.database import SessionLocal
    from app.services.passport_service import check_and_earn_stamps
    from app.utils.write_queue import enqueue_write

    def _earn():
        db = SessionLocal()
        try:
            context = {
                "score": score,
                "restoration_count": db.query(RestorationRecord).filter(
                    RestorationRecord.user_id == user_id
                ).count(),
            }
            check_and_earn_stamps(user_id, module, context, db)
        except Exception:
            db.rollback()
        finally:
            db.close()

    enqueue_write(_earn, name="stamp_check_restoration")
