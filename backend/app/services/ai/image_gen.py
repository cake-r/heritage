"""图像生成服务 — 通义万相2.1 (DashScope) + Mock支持"""

import json
import os
import logging
import shutil
from pathlib import Path

from app.services.ai.base import with_retry, AIServiceError, mock_mode
from app.config import GENERATED_DIR

logger = logging.getLogger("image_gen")


@with_retry(max_retries=2, base_delay=2.0, timeout=180)
def text_to_image(
    prompt: str,
    negative_prompt: str = "",
    count: int = 2,
    seed: int | None = None,
) -> dict:
    """
    文生图

    Returns:
        {"images": ["/static/generated/xxx_1.png", ...], "seed": 12345}
    """
    if mock_mode():
        logger.info(f"Mock模式: 文生图 count={count}")
        return _mock_generate(count, "text2img")

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY 未配置", service="通义万相", retryable=False)

    try:
        import dashscope
        from dashscope import ImageSynthesis

        import random
        actual_seed = seed or random.randint(1, 2**31)

        result = ImageSynthesis.call(
            model="wanx2.1-t2i-plus",
            prompt=prompt,
            negative_prompt=negative_prompt,
            n=count,
            seed=actual_seed,
            api_key=api_key,
            size="1024*1024",
        )

        if result.status_code != 200:
            raise AIServiceError(
                f"文生图API错误: {result.code} - {result.message}",
                service="通义万相"
            )

        # 下载图片到本地
        image_paths = []
        for i, img_result in enumerate(result.output.results):
            local_path = _download_image(img_result.url, f"t2i_{actual_seed}_{i}.png")
            image_paths.append(local_path)

        # 记录 AI 用量 (文生图无 token，按调用次数记录)
        from app.utils.ai_governance import log_ai_usage, get_ai_user
        log_ai_usage(
            user_id=get_ai_user(),
            model="wanx2.1-t2i-plus",
            endpoint="text_to_image",
            tokens_in=len(prompt),
            tokens_out=len(image_paths),
            latency_ms=0,
            status="success",
        )

        return {"images": image_paths, "seed": actual_seed}

    except ImportError:
        raise AIServiceError("dashscope SDK未安装", service="通义万相", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        raise AIServiceError(str(e), service="通义万相")


@with_retry(max_retries=2, base_delay=2.0, timeout=180)
def image_to_image(
    ref_image_path: str,
    prompt: str,
    negative_prompt: str = "",
    count: int = 2,
    seed: int | None = None,
) -> dict:
    """
    图生图

    Returns:
        {"images": ["/static/generated/xxx_1.png", ...], "seed": 12345}
    """
    if mock_mode():
        logger.info(f"Mock模式: 图生图 count={count}")
        return _mock_generate(count, "img2img")

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY 未配置", service="通义万相", retryable=False)

    try:
        import dashscope
        from dashscope import ImageSynthesis

        import random
        import time as _time
        actual_seed = seed or random.randint(1, 2**31)

        # 先上传参考图到OSS获取URL
        from dashscope import Files as DashFiles
        upload_result = DashFiles.upload(ref_image_path, purpose="inference")
        if upload_result.status_code != 200 or not upload_result.output.get("uploaded_files"):
            raise AIServiceError("上传参考图失败", service="通义万相", retryable=False)
        file_id = upload_result.output["uploaded_files"][0]["file_id"]
        file_info = DashFiles.get(file_id)
        ref_url = file_info.output["url"]

        # 调用图生图API (image2image task 要求 images 参数)
        result = ImageSynthesis.call(
            model="wan2.5-i2i-preview",
            prompt=prompt,
            negative_prompt=negative_prompt,
            images=[ref_url],
            n=count,
            seed=actual_seed,
            api_key=api_key,
            size="1024*1024",
            task="image2image",
        )

        if result.status_code != 200:
            raise AIServiceError(
                f"图生图API错误: {result.code} - {result.message}",
                service="通义万相"
            )

        # 处理异步 task-based 响应 (wan2.5-i2i-preview 返回 task_id)
        task_id = getattr(result.output, "task_id", None)
        if task_id:
            logger.info(f"图生图异步任务: task_id={task_id}, 等待完成...")
            for attempt in range(40):
                _time.sleep(3)
                fetch_response = ImageSynthesis.fetch(task_id, api_key=api_key)
                if fetch_response.status_code != 200:
                    logger.warning(f"图生图轮询失败 (attempt {attempt+1}): {fetch_response.code}")
                    continue
                task_status = getattr(fetch_response.output, "task_status", "")
                if task_status == "SUCCEEDED":
                    result = fetch_response
                    logger.info(f"图生图异步任务完成: task_id={task_id}")
                    break
                elif task_status == "FAILED":
                    raise AIServiceError(
                        f"图生图异步任务失败: task_id={task_id}, "
                        f"code={getattr(fetch_response, 'code', 'N/A')}, "
                        f"message={getattr(fetch_response, 'message', 'N/A')}",
                        service="通义万相"
                    )
            else:
                raise AIServiceError(
                    f"图生图异步任务超时: task_id={task_id}",
                    service="通义万相"
                )

        # 下载生成的图片 (使用 .url 属性访问，兼容 dict fallback)
        image_paths = []
        results = getattr(result.output, "results", None) or []
        for i, img_result in enumerate(results):
            img_url = getattr(img_result, "url", None) or (
                img_result.get("url", "") if hasattr(img_result, "get") else ""
            )
            if img_url:
                local_path = _download_image(img_url, f"i2i_{actual_seed}_{i}.png")
                image_paths.append(local_path)

        if not image_paths:
            logger.error(
                f"图生图返回空结果: status_code={result.status_code}"
            )

        # 记录 AI 用量
        from app.utils.ai_governance import log_ai_usage, get_ai_user
        log_ai_usage(
            user_id=get_ai_user(),
            model="wan2.5-i2i-preview",
            endpoint="image_to_image",
            tokens_in=len(prompt),
            tokens_out=len(image_paths),
            latency_ms=0,
            status="success",
        )

        return {"images": image_paths, "seed": actual_seed}

    except ImportError:
        raise AIServiceError("dashscope SDK未安装", service="通义万相", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        raise AIServiceError(str(e), service="通义万相")


def _download_image(url: str, filename: str) -> str:
    """下载图片到本地generated目录"""
    import httpx

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    local_path = GENERATED_DIR / filename

    try:
        with httpx.Client(timeout=60) as client:
            resp = client.get(url)
            resp.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(resp.content)
    except Exception as e:
        logger.error(f"下载图片失败: {e}")

    return f"/static/generated/{filename}"


def _mock_generate(count: int, mode: str) -> dict:
    """Mock生成 — 返回静态示例图片路径"""
    import random

    mock_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "mock" / "generated_images"
    seed = random.randint(1, 2**31)

    images = []
    if mock_dir.exists():
        available = list(mock_dir.glob("*.png")) + list(mock_dir.glob("*.jpg"))
        if available:
            chosen = random.sample(available, min(count, len(available)))
            for img_path in chosen:
                # 复制到generated目录
                dest = GENERATED_DIR / f"mock_{img_path.name}"
                shutil.copy(img_path, dest)
                images.append(f"/static/generated/mock_{img_path.name}")
            return {"images": images, "seed": seed}

    # 没有文件则返回占位
    for i in range(count):
        images.append(f"/static/generated/placeholder_{i}.png")
    return {"images": images, "seed": seed}
