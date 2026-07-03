"""文物数字修复管道 — 4步AI编排: 损伤分析 → 方案生成 → 图像修复 → 质量验证"""

import json
import base64
import os
import logging
from pathlib import Path

from app.services.ai.base import mock_mode, load_mock, AIServiceError

logger = logging.getLogger("restoration_pipeline")

MOCK_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "mock"


def _log_dashscope_usage(response, model: str, endpoint: str) -> None:
    """从 DashScope 响应提取 usage 并记录 AI 用量"""
    from app.utils.ai_governance import log_ai_usage, get_ai_user
    usage = response.usage
    log_ai_usage(
        user_id=get_ai_user(),
        model=model,
        endpoint=endpoint,
        tokens_in=usage.input_tokens if usage else 0,
        tokens_out=usage.output_tokens if usage else 0,
        latency_ms=0,
        status="success",
    )


def run_restoration_pipeline(image_path: str) -> dict:
    """
    运行完整的4步修复管道

    Args:
        image_path: 原始上传图片的本地路径

    Returns:
        {
            "pipeline_steps": [
                { "step": 1, "name": "损伤分析", "model": "qwen-vl-max", "status": "completed", "result": {...} },
                { "step": 2, "name": "修复方案", "model": "deepseek-chat", "status": "completed", "result": {...} },
                { "step": 3, "name": "图像修复", "model": "wan2.5-i2i-preview", "status": "completed", "result": {...} },
                { "step": 4, "name": "修复验证", "model": "qwen-vl-max", "status": "completed", "result": {...} },
            ],
            "restored_image_url": "/static/generated/..." or None
        }
    """
    pipeline_steps = []
    restored_image_url = None

    # === Step 1: 损伤分析 ===
    logger.info(f"[Step 1/4] 损伤分析: {image_path}")
    try:
        damage_result = _run_damage_analysis(image_path)
        pipeline_steps.append({
            "step": 1,
            "name": "损伤分析",
            "model": "qwen-vl-max",
            "status": "completed",
            "result": damage_result,
        })
    except Exception as e:
        logger.error(f"Step 1 失败: {e}")
        pipeline_steps.append({
            "step": 1, "name": "损伤分析", "model": "qwen-vl-max",
            "status": "failed", "result": {"error": str(e)},
        })
        return {"pipeline_steps": pipeline_steps, "restored_image_url": None}

    # === Step 1.5: 纹样轮廓提取 (新增) ===
    contour_result = None
    try:
        contour_result = _run_contour_extraction(image_path)
        logger.info(f"[Step 1.5/5] 轮廓提取完成")
    except Exception as e:
        logger.warning(f"Step 1.5 轮廓提取失败 (非致命): {e}")

    # === Step 2: 修复方案生成 (RAG 增强) ===
    logger.info(f"[Step 2/5] 修复方案生成 for: {damage_result.get('category')}")
    try:
        prompt_result = _run_prompt_generation(damage_result)
        pipeline_steps.append({
            "step": 2,
            "name": "修复方案生成",
            "model": "deepseek-chat",
            "status": "completed",
            "result": prompt_result,
        })
    except Exception as e:
        logger.error(f"Step 2 失败: {e}")
        pipeline_steps.append({
            "step": 2, "name": "修复方案生成", "model": "deepseek-chat",
            "status": "failed", "result": {"error": str(e)},
        })
        return {"pipeline_steps": pipeline_steps, "restored_image_url": None}

    # === Step 3: AI图像修复 (轮廓约束增强) ===
    logger.info(f"[Step 3/5] 图像修复: {image_path}")
    try:
        gen_result = _run_image_restoration(image_path, prompt_result["prompt"], contour_result)
        pipeline_steps.append({
            "step": 3,
            "name": "AI图像修复",
            "model": "wan2.5-i2i-preview",
            "status": "completed",
            "result": gen_result,
        })
        restored_image_url = gen_result["images"][0] if gen_result.get("images") else None
    except Exception as e:
        logger.error(f"Step 3 失败: {e}")
        pipeline_steps.append({
            "step": 3, "name": "AI图像修复", "model": "wan2.5-i2i-preview",
            "status": "failed", "result": {"error": str(e)},
        })
        return {"pipeline_steps": pipeline_steps, "restored_image_url": None}

    # === Step 4: 修复验证 (增强维度) ===
    if restored_image_url:
        restored_local_path = _url_to_local_path(restored_image_url)
        logger.info(f"[Step 4/5] 修复验证: {image_path} vs {restored_local_path}")
        try:
            verify_result = _run_verification_enhanced(
                image_path, restored_local_path, damage_result["category"], contour_result
            )
            pipeline_steps.append({
                "step": 4,
                "name": "修复验证",
                "model": "qwen-vl-max",
                "status": "completed",
                "result": verify_result,
            })
        except Exception as e:
            logger.error(f"Step 4 失败: {e}")
            pipeline_steps.append({
                "step": 4, "name": "修复验证", "model": "qwen-vl-max",
                "status": "failed", "result": {"error": str(e)},
            })
    else:
        pipeline_steps.append({
            "step": 4, "name": "修复验证", "model": "qwen-vl-max",
            "status": "failed", "result": {"error": "无修复图像可验证"},
        })

    return {"pipeline_steps": pipeline_steps, "restored_image_url": restored_image_url}


# ============================================================
# Step 1: Damage Analysis (Qwen-VL-Max)
# ============================================================

def _run_damage_analysis(image_path: str) -> dict:
    """用 Qwen-VL 分析图像损伤"""
    if mock_mode():
        return _mock_damage_analysis(image_path)

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY not configured", service="Qwen-VL", retryable=False)

    try:
        import dashscope
        from dashscope import MultiModalConversation

        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()

        messages = [{
            "role": "user",
            "content": [
                {"image": f"data:image/jpeg;base64,{image_b64}"},
                {"text": _DAMAGE_ANALYSIS_PROMPT}
            ]
        }]

        response = MultiModalConversation.call(
            model="qwen-vl-max",
            messages=messages,
            api_key=api_key,
        )

        if response.status_code != 200:
            raise AIServiceError(
                f"API error: {response.code} - {response.message}",
                service="Qwen-VL"
            )

        raw_text = response.output.choices[0].message.content[0]["text"]
        _log_dashscope_usage(response, "qwen-vl-max", "restoration_damage_analysis")
        return _parse_damage_response(raw_text)

    except ImportError:
        raise AIServiceError("dashscope SDK not installed", service="Qwen-VL", retryable=False)


_DAMAGE_ANALYSIS_PROMPT = """You are a cultural relic restoration expert. Analyze this image of a traditional Chinese handicraft and identify any damage, deterioration, or quality issues.

Return strictly in JSON format (no markdown, no extra text):
{
  "category": "identified craft category (e.g. 陶瓷, 刺绣, 剪纸, 皮影, 紫砂壶, 木雕, or 非遗工艺品 if unclear)",
  "damage_types": ["damage type 1", "damage type 2"],
  "severity": "轻度 or 中度 or 重度",
  "description": "Detailed damage analysis in Chinese (200-400 characters), describing what is damaged, where, and the extent",
  "damage_regions": [
    {"x": 100, "y": 200, "width": 150, "height": 120, "description": "釉面剥落区域,面积约15%", "severity": "重度"},
    {"x": 300, "y": 50, "width": 80, "height": 60, "description": "表面裂纹区域", "severity": "轻度"}
  ]
}

For damage_regions: provide bounding box coordinates (x, y from top-left corner, width, height in pixels) for each visually damaged area. Estimate coordinates as proportions of the image — assume the image is 1024x1024. Include ALL visible damage areas (at least 1, at most 6). Coordinates must be integers. If no specific damage region is visible, return an empty array [].

Damage types to consider: 釉面剥落, 表面裂纹, 色彩氧化, 丝线褪色, 局部破损, 污渍, 纸张泛黄, 边缘破损, 折叠痕迹, 皮革龟裂, 颜料脱落, 连接处松动, 表面磨损, 漆面剥落, 虫蛀痕迹, 画面模糊, 细节丢失, 对比度不足, 噪点"""


def _parse_damage_response(raw_text: str) -> dict:
    """解析损伤分析 JSON 响应"""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"Damage analysis JSON parse failed, using raw text")
        return {
            "category": "非遗工艺品",
            "damage_types": ["画面模糊"],
            "severity": "轻度",
            "description": raw_text[:400],
            "damage_regions": [],
        }

    return {
        "category": data.get("category", "非遗工艺品"),
        "damage_types": data.get("damage_types", []),
        "severity": data.get("severity", "轻度"),
        "description": data.get("description", ""),
        "damage_regions": data.get("damage_regions", []),
    }


def _mock_damage_analysis(image_path: str) -> dict:
    """Mock 模式: 按文件名关键词匹配损伤分析"""
    filename = Path(image_path).stem.lower()
    mock_data = load_mock("damage_analysis.json")

    if mock_data and "samples" in mock_data:
        for sample in mock_data["samples"]:
            for kw in sample.get("keywords", []):
                if kw.lower() in filename:
                    logger.info(f"Mock damage matched: {sample['category']} via keyword '{kw}'")
                    return {
                        "category": sample["category"],
                        "damage_types": sample["damage_types"],
                        "severity": sample["severity"],
                        "description": sample["description"],
                        "damage_regions": sample.get("damage_regions", []),
                    }

    # Fallback to default
    if mock_data and "default" in mock_data:
        d = mock_data["default"]
        return {
            "category": d["category"],
            "damage_types": d["damage_types"],
            "severity": d["severity"],
            "description": d["description"],
            "damage_regions": d.get("damage_regions", []),
        }

    # Ultimate fallback (no JSON file)
    return {
        "category": "非遗工艺品",
        "damage_types": ["画面模糊", "细节丢失"],
        "severity": "轻度",
        "description": "该图片整体存在轻微模糊和对比度不足的问题。部分细节区域因拍摄条件限制出现噪点和纹理丢失，但主体结构完整，可通过AI修复恢复大部分细节。",
        "damage_regions": [],
    }


# ============================================================
# Step 2: Restoration Prompt Generation (DeepSeek)
# ============================================================

def _run_prompt_generation(damage_result: dict) -> dict:
    """用 DeepSeek 生成修复提示词"""
    if mock_mode():
        return _mock_prompt_generation(damage_result["category"])

    from app.services.ai.llm import chat

    messages = [
        {
            "role": "system",
            "content": "You are a cultural relic conservation expert specialized in traditional Chinese handicraft restoration. Generate a detailed image restoration prompt that describes the ideal restored state of the artifact. The prompt should be in Chinese with an English suffix for image generation quality keywords."
        },
        {
            "role": "user",
            "content": f"""请根据以下损伤分析，生成一个详细的图像修复提示词（中文为主，末尾加英文质量关键词）。

文物品类: {damage_result["category"]}
损伤类型: {", ".join(damage_result["damage_types"])}
损伤程度: {damage_result["severity"]}
损伤描述: {damage_result["description"]}

要求：
1. 描述修复后的理想状态（颜色、纹理、完整度）
2. 指明需要重点修复的区域和方式
3. 保持文物的手工质感和历史真实感
4. 200-400字，语言精准专业

直接给出提示词，不需要JSON包裹。"""
        }
    ]

    prompt = chat(messages, stream=False)
    return {"prompt": prompt.strip()}


def _mock_prompt_generation(category: str) -> dict:
    """Mock 模式: 按品类匹配修复提示词"""
    mock_data = load_mock("restoration_prompts.json")

    if mock_data:
        if category in mock_data:
            return {"prompt": mock_data[category]}
        if "default" in mock_data:
            return {"prompt": mock_data["default"]}

    # Ultimate fallback
    return {
        "prompt": f"修复该{category}作品，保持原始艺术风格和材质质感。增强清晰度，去除噪点和模糊。修复破损和缺失区域，根据周围内容推理重建。保持文物的历史真实感和手工制作痕迹。high quality, cultural heritage restoration, professional photography, 4K, detailed texture."
    }


# ============================================================
# Step 3: Image Restoration (Wanx 2.5 I2I) — 实现在文件末尾
# ============================================================


# ============================================================
# Step 4: Verification (Qwen-VL-Max, dual-image)
# ============================================================

def _run_verification(original_path: str, restored_path: str, category: str) -> dict:
    """用 Qwen-VL 对比原图和修复图，评估修复质量"""
    if mock_mode():
        return _mock_verification(category)

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY not configured", service="Qwen-VL", retryable=False)

    try:
        import dashscope
        from dashscope import MultiModalConversation

        with open(original_path, "rb") as f:
            original_b64 = base64.b64encode(f.read()).decode()
        with open(restored_path, "rb") as f:
            restored_b64 = base64.b64encode(f.read()).decode()

        messages = [{
            "role": "user",
            "content": [
                {"image": f"data:image/jpeg;base64,{original_b64}"},
                {"image": f"data:image/jpeg;base64,{restored_b64}"},
                {"text": _VERIFICATION_PROMPT}
            ]
        }]

        response = MultiModalConversation.call(
            model="qwen-vl-max",
            messages=messages,
            api_key=api_key,
        )

        if response.status_code != 200:
            raise AIServiceError(
                f"API error: {response.code} - {response.message}",
                service="Qwen-VL"
            )

        raw_text = response.output.choices[0].message.content[0]["text"]
        _log_dashscope_usage(response, "qwen-vl-max", "restoration_verification")
        return _parse_verification_response(raw_text)

    except ImportError:
        raise AIServiceError("dashscope SDK not installed", service="Qwen-VL", retryable=False)


_VERIFICATION_PROMPT = """You are a strict restoration quality evaluator. Compare the FIRST image (original/damaged) with the SECOND image (AI-restored) and score the restoration quality.

Return strictly in JSON format (no markdown, no extra text):
{
  "overall_score": 85,
  "dimensions": {
    "detail_fidelity": 82,
    "style_consistency": 90,
    "restoration_completeness": 83
  },
  "verdict": "Overall assessment in Chinese (100-200 characters)",
  "artifacts": ["issue 1", "issue 2"]
}

Scoring dimensions (1-100):
- detail_fidelity (细节保真度): Are original textures, patterns, and details preserved?
- style_consistency (风格一致性): Does the restored area blend naturally with the original?
- restoration_completeness (损伤修复完整度): Are all damaged areas properly addressed?
- overall_score: weighted average (detail 35%, style 30%, completeness 35%)

artifacts: List any AI-generated artifacts (blur, distortion, color shift, over-smoothing). Empty array if none.

CRITICAL: Be genuinely critical. Don't give high scores just because it's AI-generated. If the restoration is poor, say so."""


def _parse_verification_response(raw_text: str) -> dict:
    """解析验证 JSON 响应"""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"Verification JSON parse failed, using raw text")
        return {
            "overall_score": 75,
            "dimensions": {
                "detail_fidelity": 75,
                "style_consistency": 75,
                "restoration_completeness": 75,
            },
            "verdict": raw_text[:300],
            "artifacts": [],
        }

    dims = data.get("dimensions", {})
    return {
        "overall_score": data.get("overall_score", 75),
        "dimensions": {
            "detail_fidelity": dims.get("detail_fidelity", 75),
            "style_consistency": dims.get("style_consistency", 75),
            "restoration_completeness": dims.get("restoration_completeness", 75),
        },
        "verdict": data.get("verdict", ""),
        "artifacts": data.get("artifacts", []),
    }


def _mock_verification(category: str) -> dict:
    """Mock 模式: 按品类返回验证报告"""
    # Category-specific mock reports
    category_reports = {
        "陶瓷": {
            "overall_score": 85,
            "dimensions": {"detail_fidelity": 82, "style_consistency": 90, "restoration_completeness": 83},
            "verdict": "修复效果良好。釉面剥落区域已平滑填充，与周围釉面的光泽度基本一致。底部裂纹修复自然，纹路连续性好。口沿处青花纹饰颜色恢复到位。美中不足的是修复区域的笔触略柔，与原器物手工绘制痕迹的锐利度有细微差异。",
            "artifacts": ["修复区域笔触略柔和", "釉面反光均匀度过高"],
        },
        "刺绣": {
            "overall_score": 91,
            "dimensions": {"detail_fidelity": 93, "style_consistency": 88, "restoration_completeness": 92},
            "verdict": "修复效果优秀。褪色区域颜色还原准确，与原始丝线色调自然衔接。破损区域的重建针法推理合理，与周围纹样协调。污渍清除效果良好。整体绣面质感保留完整。",
            "artifacts": [],
        },
        "剪纸": {
            "overall_score": 88,
            "dimensions": {"detail_fidelity": 86, "style_consistency": 91, "restoration_completeness": 87},
            "verdict": "修复效果良好。纸张泛黄问题已有效去除，红色恢复鲜艳。边缘破损区域重建自然，折叠痕迹基本消除。个别镂空细节处的锐利度略低于原作。整体效果令人满意。",
            "artifacts": ["镂空边缘略柔和"],
        },
        "皮影": {
            "overall_score": 78,
            "dimensions": {"detail_fidelity": 72, "style_consistency": 82, "restoration_completeness": 80},
            "verdict": "修复效果基本合格。皮革龟裂区域已平滑处理，面部颜料得到部分恢复。但由于原始损伤较严重（重度），部分细节的AI重建存在推测性填充，与原始皮影工艺存在差异。建议结合人工修复进一步优化。",
            "artifacts": ["面部细节存在推测性填充", "色彩饱和度偏高"],
        },
        "紫砂壶": {
            "overall_score": 90,
            "dimensions": {"detail_fidelity": 92, "style_consistency": 88, "restoration_completeness": 90},
            "verdict": "修复效果良好。表面磨损痕迹已有效平滑，壶盖缺口修复自然。包浆色泽均匀，紫砂特有的温润质感得到保留。底部款识清晰可辨。整体效果接近原器物状态。",
            "artifacts": ["局部纹理略显均匀"],
        },
        "木雕": {
            "overall_score": 82,
            "dimensions": {"detail_fidelity": 80, "style_consistency": 85, "restoration_completeness": 81},
            "verdict": "修复效果良好。干裂纹理已填补，与周围木质融合自然。漆面修复区域的色泽基本匹配。虫蛀小孔已填补但表面纹理略平滑。雕刻刀法痕迹在修复区域略有减弱。",
            "artifacts": ["修复区域表面略平滑", "漆面反光与原漆微有差异"],
        },
    }

    if category in category_reports:
        return category_reports[category]

    return {
        "overall_score": 80,
        "dimensions": {"detail_fidelity": 78, "style_consistency": 82, "restoration_completeness": 80},
        "verdict": "修复效果基本合格。主体结构恢复完整，细节区域的纹理重建基本准确。整体风格协调，可作为预览参考使用。建议进一步人工精修以达到展览级别。",
        "artifacts": ["局部纹理略模糊", "边缘过渡不够自然"],
    }


# ============================================================
# Step 1.5: Contour Extraction (OpenCV)
# ============================================================

def _run_contour_extraction(image_path: str) -> dict | None:
    """提取文物纹样轮廓线，作为修复约束"""
    try:
        import cv2
        import numpy as np

        img = cv2.imread(image_path)
        if img is None:
            return None

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # Canny 边缘检测
        edges = cv2.Canny(gray, 50, 150)
        # 查找轮廓
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # 保留有效轮廓 (> 50 像素)
        valid_contours = [c for c in contours if cv2.contourArea(c) > 50]
        contour_count = len(valid_contours)

        # 生成轮廓描述文本 (注入 prompt)
        h, w = img.shape[:2]
        contour_desc = (
            f"该文物尺寸 {w}x{h} 像素，"
            f"检测到 {contour_count} 条主要纹样轮廓线。"
            f"修复时请保持轮廓结构不变，仅填充缺失纹理和颜色。"
        )

        return {
            "contour_count": contour_count,
            "image_size": [w, h],
            "contour_description": contour_desc,
        }
    except ImportError:
        logger.debug("OpenCV 未安装，跳过轮廓提取")
        return None
    except Exception as e:
        logger.debug(f"轮廓提取异常 (非致命): {e}")
        return None


# ============================================================
# Step 3: Image Restoration (updated signature)
# ============================================================

def _run_image_restoration(image_path: str, prompt: str, contour_result: dict | None = None) -> dict:
    """调用 Wanx I2I 进行图像修复，可选注入轮廓约束"""
    # 如果有轮廓信息，增强 prompt
    if contour_result and contour_result.get("contour_description"):
        enhanced_prompt = (
            f"{prompt}\n\n【结构约束】{contour_result['contour_description']}"
        )
    else:
        enhanced_prompt = prompt

    # 调用原始实现 (保持向后兼容)
    return _run_image_restoration_original(image_path, enhanced_prompt)


def _run_image_restoration_original(image_path: str, prompt: str) -> dict:
    """原始的 Wanx I2I 调用 — 通过 DashFiles 上传获取 URL，使用 images 参数"""
    if mock_mode():
        return _mock_image_restoration()

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY not configured", service="Wanx-I2I", retryable=False)

    try:
        import dashscope
        from dashscope import ImageSynthesis
        from dashscope import Files as DashFiles
        import random

        # 上传图片到 DashScope OSS 获取公网 URL
        upload_result = DashFiles.upload(image_path, purpose="inference")
        if upload_result.status_code != 200 or not upload_result.output.get("uploaded_files"):
            raise AIServiceError(
                f"上传参考图失败: {upload_result.code} - {upload_result.message}",
                service="Wanx-I2I"
            )
        file_id = upload_result.output["uploaded_files"][0]["file_id"]
        file_info = DashFiles.get(file_id)
        ref_url = file_info.output["url"]

        negative_prompt = "blurry, distorted, deformed, low quality, watermarks, text, ugly, unnatural colors"
        actual_seed = random.randint(1, 2**31)

        response = ImageSynthesis.call(
            model="wan2.5-i2i-preview",
            prompt=prompt,
            negative_prompt=negative_prompt,
            images=[ref_url],
            n=1,
            seed=actual_seed,
            api_key=api_key,
            size="1024*1024",
            task="image2image",
        )

        if response.status_code != 200:
            raise AIServiceError(
                f"API error: {response.code} - {response.message}",
                service="Wanx-I2I"
            )

        # 记录 AI 用量 (Wanx I2I 无 token，按调用次数)
        from app.utils.ai_governance import log_ai_usage, get_ai_user
        log_ai_usage(
            user_id=get_ai_user(),
            model="wan2.5-i2i-preview",
            endpoint="restoration_image_repair",
            tokens_in=len(prompt),
            tokens_out=1,
            latency_ms=0,
            status="success",
        )

        # 下载生成的图片
        images = []
        for img_result in response.output.results:
            img_url = img_result.get("url", "")
            if img_url:
                local_path = _download_generated_image(img_url, f"restored_{os.path.basename(image_path)}")
                images.append(f"/static/generated/{os.path.basename(local_path)}")

        return {"images": images, "prompt_used": prompt}

    except ImportError:
        raise AIServiceError("dashscope SDK not installed", service="Wanx-I2I", retryable=False)


# ============================================================
# Step 4: Enhanced Verification (new dimensions)
# ============================================================

def _run_verification_enhanced(
    original_path: str,
    restored_path: str,
    category: str,
    contour_result: dict | None = None,
) -> dict:
    """增强验证 — 添加 pattern_similarity 和 enhanced_style_consistency 维度"""
    if mock_mode():
        return _mock_verification_enhanced(category)

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY not configured", service="Qwen-VL", retryable=False)

    try:
        import dashscope
        from dashscope import MultiModalConversation

        with open(original_path, "rb") as f:
            orig_b64 = base64.b64encode(f.read()).decode()
        with open(restored_path, "rb") as f:
            rest_b64 = base64.b64encode(f.read()).decode()

        contour_hint = ""
        if contour_result:
            contour_hint = (
                f"轮廓信息: 原图有 {contour_result.get('contour_count', '?')} 条纹样轮廓线。"
                f"检查修复后轮廓是否保持完整。"
            )

        prompt = _ENHANCED_VERIFICATION_PROMPT.format(
            category=category,
            contour_hint=contour_hint,
        )

        messages = [{
            "role": "user",
            "content": [
                {"image": f"data:image/jpeg;base64,{orig_b64}"},
                {"image": f"data:image/jpeg;base64,{rest_b64}"},
                {"text": prompt},
            ]
        }]

        response = MultiModalConversation.call(
            model="qwen-vl-max",
            messages=messages,
            api_key=api_key,
        )

        if response.status_code != 200:
            raise AIServiceError(f"API error: {response.code}", service="Qwen-VL")

        raw_text = response.output.choices[0].message.content[0]["text"]
        _log_dashscope_usage(response, "qwen-vl-max", "restoration_verification_enhanced")
        return _parse_verification_enhanced(raw_text)

    except ImportError:
        raise AIServiceError("dashscope SDK not installed", service="Qwen-VL", retryable=False)


_ENHANCED_VERIFICATION_PROMPT = """You are a cultural relic restoration expert. Compare the ORIGINAL damaged artifact image with the AI-RESTORED image and evaluate the restoration quality along 5 dimensions.

Category: {category}
{contour_hint}

Return strictly in JSON format:
{{
  "overall_score": <1-100>,
  "dimensions": {{
    "detail_fidelity": <1-100, how well fine details are preserved/reconstructed>,
    "style_consistency": <1-100, consistency of artistic style with the original>,
    "restoration_completeness": <1-100, how thoroughly damage was repaired>,
    "pattern_similarity": <1-100, how closely restored patterns match original contour/structure>,
    "texture_naturalness": <1-100, whether the repaired texture looks natural vs AI-generated>
  }},
  "verdict": "<30-200 char summary in Chinese>",
  "artifacts": ["<specific issue 1>", "<specific issue 2>"] or []
}}

Evaluation criteria:
- pattern_similarity: Compare the structural outlines and pattern contours. Has the restoration preserved the original shape language?
- texture_naturalness: Does the repaired surface look like authentic material (porcelain, silk, paper, leather, wood, etc.) or does it have an artificial "AI smoothness"?

CRITICAL: Be genuinely critical. Don't give high scores just because it's AI-generated."""


def _parse_verification_enhanced(raw_text: str) -> dict:
    """解析增强验证 JSON 响应"""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {
            "overall_score": 75,
            "dimensions": {
                "detail_fidelity": 75, "style_consistency": 75,
                "restoration_completeness": 75, "pattern_similarity": 70,
                "texture_naturalness": 70,
            },
            "verdict": raw_text[:300],
            "artifacts": [],
        }

    dims = data.get("dimensions", {})
    return {
        "overall_score": data.get("overall_score", 75),
        "dimensions": {
            "detail_fidelity": dims.get("detail_fidelity", 75),
            "style_consistency": dims.get("style_consistency", 75),
            "restoration_completeness": dims.get("restoration_completeness", 75),
            "pattern_similarity": dims.get("pattern_similarity", 70),
            "texture_naturalness": dims.get("texture_naturalness", 70),
        },
        "verdict": data.get("verdict", ""),
        "artifacts": data.get("artifacts", []),
    }


def _mock_verification_enhanced(category: str) -> dict:
    """Mock 增强验证"""
    base = _mock_verification(category)
    base["dimensions"]["pattern_similarity"] = 85
    base["dimensions"]["texture_naturalness"] = 80
    return base


# ============================================================
# Local Restoration (用户框选区域修复)
# ============================================================

def run_local_restoration(image_path: str, region: dict, feather_radius: int = 10) -> dict:
    """
    局部修复: 仅修复用户指定的矩形区域，使用 seamlessClone 自然融合边缘。

    Args:
        image_path: 原始图片路径
        region: {{x, y, width, height}} (像素坐标)
        feather_radius: 边缘羽化半径 (像素)，用于蒙版腐蚀

    Returns:
        与 run_restoration_pipeline 相同格式的结果
    """
    import cv2
    import numpy as np
    from pathlib import Path

    x, y, w, h = int(region["x"]), int(region["y"]), int(region["width"]), int(region["height"])

    # 裁剪区域
    img = cv2.imread(image_path)
    if img is None:
        raise AIServiceError("无法读取图片", service="LocalRestoration", retryable=False)

    # 边界检查
    ih, iw = img.shape[:2]
    x = max(0, min(x, iw - 1))
    y = max(0, min(y, ih - 1))
    w = max(1, min(w, iw - x))
    h = max(1, min(h, ih - y))

    crop = img[y:y + h, x:x + w]
    crop_path = str(Path(image_path).parent / f"crop_{Path(image_path).stem}.jpg")
    cv2.imwrite(crop_path, crop)

    # 对裁剪区域运行完整管道
    result = run_restoration_pipeline(crop_path)

    # 如果修复成功，使用 seamlessClone 自然融合回原图
    if result.get("restored_image_url"):
        restored_crop_path = _url_to_local_path(result["restored_image_url"])
        restored_crop = cv2.imread(restored_crop_path)
        if restored_crop is not None:
            restored_crop = cv2.resize(restored_crop, (w, h))

            # 创建蒙版: 全白矩形，边缘腐蚀创建羽化过渡区
            mask = np.full((h, w), 255, dtype=np.uint8)
            if feather_radius > 0 and w > feather_radius * 2 and h > feather_radius * 2:
                kernel = np.ones((feather_radius, feather_radius), np.uint8)
                mask = cv2.erode(mask, kernel, iterations=1)

            center = (x + w // 2, y + h // 2)

            try:
                # Poisson 融合: NORMAL_CLONE 保留纹理细节
                blended = cv2.seamlessClone(
                    restored_crop, img, mask, center, cv2.NORMAL_CLONE
                )
                img = blended
                logger.info(f"seamlessClone 融合成功: region ({x},{y},{w},{h})")
            except cv2.error as e:
                # 回退到硬拼接
                logger.warning(f"seamlessClone 失败，回退硬拼接: {e}")
                img[y:y + h, x:x + w] = restored_crop

            blended_path = str(Path(image_path).parent / f"blended_{Path(image_path).stem}.jpg")
            cv2.imwrite(blended_path, img)
            result["restored_image_url"] = f"/static/generated/{Path(blended_path).name}"

    return result


# ============================================================
# Utility
# ============================================================

def _url_to_local_path(url: str) -> str:
    """将 /static/generated/foo.png 转为本地绝对路径"""
    from app.config import GENERATED_DIR
    filename = Path(url).name
    return str(GENERATED_DIR / filename)


def _download_generated_image(url: str, filename: str) -> str:
    """下载 AI 生成的图片到本地 generated 目录"""
    import httpx
    from app.config import GENERATED_DIR

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    local_path = GENERATED_DIR / filename

    try:
        with httpx.Client(timeout=60) as client:
            resp = client.get(url)
            resp.raise_for_status()
            with open(local_path, "wb") as f:
                f.write(resp.content)
    except Exception as e:
        logger.error(f"下载生成图片失败: {e}")

    return str(local_path)


def _mock_image_restoration() -> dict:
    """Mock 模式: 复制示例图片作为修复结果"""
    from app.services.ai.image_gen import _mock_generate
    result = _mock_generate(count=1, mode="img2img")
    return {"images": result["images"], "seed": result["seed"]}
