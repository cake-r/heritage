"""文物数字修复管道 — 4步AI编排: 损伤分析 → 方案生成 → 图像修复 → 质量验证"""

import json
import base64
import os
import logging
from pathlib import Path

from app.services.ai.base import mock_mode, load_mock, AIServiceError

logger = logging.getLogger("restoration_pipeline")

MOCK_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "mock"


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

    # === Step 2: 修复方案生成 ===
    logger.info(f"[Step 2/4] 修复方案生成 for: {damage_result.get('category')}")
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

    # === Step 3: AI图像修复 ===
    logger.info(f"[Step 3/4] 图像修复: {image_path}")
    try:
        gen_result = _run_image_restoration(image_path, prompt_result["prompt"])
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

    # === Step 4: 修复验证 ===
    if restored_image_url:
        restored_local_path = _url_to_local_path(restored_image_url)
        logger.info(f"[Step 4/4] 修复验证: {image_path} vs {restored_local_path}")
        try:
            verify_result = _run_verification(image_path, restored_local_path, damage_result["category"])
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
        return _parse_damage_response(raw_text)

    except ImportError:
        raise AIServiceError("dashscope SDK not installed", service="Qwen-VL", retryable=False)


_DAMAGE_ANALYSIS_PROMPT = """You are a cultural relic restoration expert. Analyze this image of a traditional Chinese handicraft and identify any damage, deterioration, or quality issues.

Return strictly in JSON format (no markdown, no extra text):
{
  "category": "identified craft category (e.g. 陶瓷, 刺绣, 剪纸, 皮影, 紫砂壶, 木雕, or 非遗工艺品 if unclear)",
  "damage_types": ["damage type 1", "damage type 2"],
  "severity": "轻度 or 中度 or 重度",
  "description": "Detailed damage analysis in Chinese (200-400 characters), describing what is damaged, where, and the extent"
}

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
        }

    return {
        "category": data.get("category", "非遗工艺品"),
        "damage_types": data.get("damage_types", []),
        "severity": data.get("severity", "轻度"),
        "description": data.get("description", ""),
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
                    }

    # Fallback to default
    if mock_data and "default" in mock_data:
        d = mock_data["default"]
        return {
            "category": d["category"],
            "damage_types": d["damage_types"],
            "severity": d["severity"],
            "description": d["description"],
        }

    # Ultimate fallback (no JSON file)
    return {
        "category": "非遗工艺品",
        "damage_types": ["画面模糊", "细节丢失"],
        "severity": "轻度",
        "description": "该图片整体存在轻微模糊和对比度不足的问题。部分细节区域因拍摄条件限制出现噪点和纹理丢失，但主体结构完整，可通过AI修复恢复大部分细节。",
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
# Step 3: Image Restoration (Wanx 2.5 I2I)
# ============================================================

def _run_image_restoration(image_path: str, prompt: str) -> dict:
    """用通义万相 2.5 图生图 进行修复"""
    from app.services.ai.image_gen import image_to_image

    negative_prompt = "damage, cracks, stains, blur, noise, missing parts, broken, decay, faded, torn, rust, dust, scratch, distortion, oversaturated, over-sharpened, artificial looking, plastic texture"

    result = image_to_image(
        ref_image_path=image_path,
        prompt=prompt,
        negative_prompt=negative_prompt,
        count=1,
    )
    return {"images": result["images"], "seed": result["seed"]}


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
# Utility
# ============================================================

def _url_to_local_path(url: str) -> str:
    """将 /static/generated/foo.png 转为本地绝对路径"""
    from app.config import GENERATED_DIR
    filename = Path(url).name
    return str(GENERATED_DIR / filename)
