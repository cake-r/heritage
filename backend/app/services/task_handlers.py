"""任务处理器注册 — 在调度器启动后注册各类型任务的处理函数"""

import json
import logging
from app.services.task_scheduler import register_handler

logger = logging.getLogger("task_handlers")


def _handle_restoration(task_type: str, payload: dict, task) -> dict:
    """处理数字修复任务 — 调用 4 步 AI 管道"""
    from app.models.database import SessionLocal
    from app.services.ai.restoration_pipeline import run_restoration_pipeline

    image_url = payload.get("image_url", "")
    if not image_url:
        raise ValueError("缺少 image_url 参数")

    db = SessionLocal()
    try:
        # 更新进度
        task.progress = 10
        db.query(type(task)).filter(type(task).id == task.id).update({"progress": 10})
        db.commit()

        # 执行修复管道
        result = run_restoration_pipeline(image_url)

        # 从管道步骤中提取各阶段数据
        pipeline_steps = result.get("pipeline_steps", [])
        step1 = pipeline_steps[0].get("result", {}) if len(pipeline_steps) > 0 else {}
        step2 = pipeline_steps[1].get("result", {}) if len(pipeline_steps) > 1 else {}
        step3 = pipeline_steps[2].get("result", {}) if len(pipeline_steps) > 2 else {}
        step4 = pipeline_steps[3].get("result", {}) if len(pipeline_steps) > 3 else {}

        # 判断管道状态
        any_failed = any(s.get("status") == "failed" for s in pipeline_steps)
        pipeline_status = "failed" if any_failed else "completed"

        # 保存记录到数据库
        from app.models.restoration import RestorationRecord
        record = RestorationRecord(
            user_id=task.user_id,
            original_image_path=image_url,
            damage_category=step1.get("category"),
            damage_types_json=json.dumps(step1.get("damage_types", []), ensure_ascii=False),
            damage_severity=step1.get("severity"),
            damage_description=step1.get("description"),
            restoration_prompt=step2.get("prompt"),
            restored_images_json=json.dumps(
                step3.get("images", []) if len(pipeline_steps) > 2 else [],
                ensure_ascii=False,
            ) if len(pipeline_steps) > 2 else None,
            restoration_seed=step3.get("seed") if len(pipeline_steps) > 2 else None,
            verification_score=step4.get("overall_score"),
            verification_json=json.dumps(step4, ensure_ascii=False),
            pipeline_status=pipeline_status,
            pipeline_error=next((s.get("result", {}).get("error", "")
                                 for s in pipeline_steps if s.get("status") == "failed"), None),
        )
        db.add(record)
        db.commit()

        return {
            "record_id": record.id,
            "restored_image_url": result.get("restored_image_url", ""),
            "status": pipeline_status,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _handle_image_gen(task_type: str, payload: dict, task) -> dict:
    """处理图像生成任务"""
    from app.models.database import SessionLocal
    from app.services.ai.image_gen import generate_text_to_image

    prompt = payload.get("prompt", "")
    style = payload.get("style", "traditional")
    if not prompt:
        raise ValueError("缺少 prompt 参数")

    db = SessionLocal()
    try:
        task.progress = 30
        db.query(type(task)).filter(type(task).id == task.id).update({"progress": 30})
        db.commit()

        result = generate_text_to_image(prompt, style)

        from app.models.generation import GeneratedWork
        work = GeneratedWork(
            user_id=task.user_id,
            prompt=prompt,
            image_url=result.get("image_url", ""),
            style=style,
        )
        db.add(work)
        db.commit()

        return {
            "work_id": work.id,
            "image_url": result.get("image_url", ""),
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def register_all_handlers():
    """注册所有任务处理器（在应用启动时调用一次）"""
    register_handler("restoration", _handle_restoration)
    register_handler("image_gen", _handle_image_gen)
    logger.info("所有任务处理器已注册")
