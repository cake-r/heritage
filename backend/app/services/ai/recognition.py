"""Image recognition service — Qwen-VL-Max (DashScope) + Mock support"""

import json
import logging
import base64
import os
from pathlib import Path

from app.services.ai.base import with_retry, AIServiceError, mock_mode, load_mock
from app.services.agent.execution_tracker import track_execution, track_step
from app.services.agent.step_defs import RECOGNITION_STEPS

logger = logging.getLogger("recognition")

# Confidence threshold — results below this are considered unreliable
CONFIDENCE_THRESHOLD = 0.35
# Category returned when recognition fails
UNKNOWN_CATEGORY = "无法识别"


@track_execution(module="recognition", steps=RECOGNITION_STEPS)
@with_retry(max_retries=3, base_delay=1.0, timeout=60)
def recognize(image_path: str) -> dict:
    """
    Recognize ICH handicraft image

    Args:
        image_path: local image path

    Returns:
        {
            "category": "苏绣",
            "confidence": 0.94,
            "top3": [{"category":"苏绣","confidence":0.94}, ...],
            "features": ["平针绣","套针","抢针"],
            "raw_description": "..."
        }
    """
    # === Mock mode ===
    if mock_mode():
        logger.info(f"Mock mode: recognizing {image_path}")
        track_step("recognize", "running")
        matched = _mock_response(image_path)
        filename = Path(image_path).stem.lower()
        known_keys = ["suxiu", "cixiu", "jianzhi", "taoci", "piying", "zishahu"]
        if any(k in filename for k in known_keys):
            track_step("recognize", "completed", detail={"category": matched.get("category", "")})
            return matched
        # No match — return unknown instead of random guess
        logger.info("Mock mode: no match found, returning unknown")
        track_step("recognize", "completed", detail={"category": UNKNOWN_CATEGORY})
        return {
            "category": UNKNOWN_CATEGORY,
            "confidence": 0.0,
            "top3": [],
            "features": [],
            "pattern_names": [],
            "raw_description": "Cannot identify this image as a known ICH category. Please upload traditional handicraft images.",
        }

    # === Real API ===
    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY not configured", service="Qwen-VL", retryable=False)

    try:
        import dashscope
        from dashscope import MultiModalConversation

        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()

        track_step("recognize", "running")

        messages = [{
            "role": "user",
            "content": [
                {"image": f"data:image/jpeg;base64,{image_b64}"},
                {"text": _build_recognition_prompt()}
            ]
        }]

        response = MultiModalConversation.call(
            model="qwen-vl-max",
            messages=messages,
            api_key=api_key,
        )

        if response.status_code != 200:
            track_step("recognize", "failed", error=f"API error: {response.code}")
            raise AIServiceError(
                f"API error: {response.code} - {response.message}",
                service="Qwen-VL"
            )

        raw_text = response.output.choices[0].message.content[0]["text"]

        # 记录 AI 用量
        from app.utils.ai_governance import log_ai_usage, get_ai_user
        usage = response.usage
        log_ai_usage(
            user_id=get_ai_user(),
            model="qwen-vl-max",
            endpoint="recognition",
            tokens_in=usage.input_tokens if usage else 0,
            tokens_out=usage.output_tokens if usage else 0,
            latency_ms=0,
            status="success",
        )

        result = _parse_response(raw_text, image_path)
        track_step("recognize", "completed", detail={
            "category": result.get("category", ""),
            "confidence": result.get("confidence", 0),
        })
        return result

    except ImportError:
        raise AIServiceError("dashscope SDK not installed: pip install dashscope", service="Qwen-VL", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        track_step("recognize", "failed", error=str(e))
        raise AIServiceError(str(e), service="Qwen-VL")


def _build_recognition_prompt() -> str:
    return """Identify this image as a Chinese Intangible Cultural Heritage (ICH) handicraft category.

Try your best to match the image to the closest ICH category, even for non-perfect matches (modern reproductions, partial views, decorative items inspired by traditional crafts). Only use "无法识别" if the image has NO connection whatsoever to Chinese traditional crafts (e.g., purely modern objects like cars, Western-style portraits, natural landscapes without cultural elements).

Return strictly in JSON format:
{
  "category": "ICH category name, use '无法识别' only as last resort",
  "confidence": 0.85,
  "top3": [
    {"category": "category1", "confidence": 0.85},
    {"category": "category2", "confidence": 0.10},
    {"category": "category3", "confidence": 0.05}
  ],
  "features": ["feature1", "feature2", "feature3"],
  "pattern_names": ["云纹", "回纹", "缠枝纹"],
  "description": "Detailed visual description including patterns, techniques, materials, colors, style era (80-150 words)"
}

Important rules:
- confidence: reflect how certain you are. 0.85+ for clear matches, 0.5-0.85 for plausible but uncertain, below 0.5 only for pure guesses.
- top3 confidences MUST sum to 1.0.
- features: list 3-5 observable craft techniques or visual characteristics (can be general like "手工制作痕迹", "传统纹样装饰" for uncertain images).
- pattern_names: list up to 5 traditional Chinese decorative patterns/motifs visible in the image from this catalog:
  几何纹(18): 回纹 方胜纹 龟背纹 冰裂纹 锁子纹 铜钱纹 八卦纹 菱格纹 条纹边饰 联珠纹 球路纹 八达晕纹 方棋纹 矩纹 绳纹 鳞纹 弦纹 席纹
  动物纹(16): 饕餮纹 龙纹 凤纹 蝙蝠纹 鱼纹 蝴蝶纹 鹤纹 鹿纹 麒麟纹 狮纹 鸳鸯纹 喜鹊纹 孔雀纹 蝉纹 虎纹 象纹
  植物纹(16): 缠枝纹 莲花纹 牡丹纹 卷草纹 梅花纹 竹纹 菊花纹 兰花纹 石榴纹 松纹 灵芝纹 葫芦纹 葡萄纹 桃花纹 蕉叶纹 忍冬纹
  云水纹(12): 祥云纹 水波纹 火焰纹 雷纹 涡纹 江崖纹 海涛纹 流云纹 朵云纹 星纹 霞纹 卷云纹
  吉祥文字纹(10): 寿字纹 万字纹 如意纹 盘长纹 双喜纹 福字纹 禄字纹 太极纹 璎珞纹 八吉纹
  综合纹(13): 宝相花纹 团花纹 博古纹 暗八仙纹 皮球花纹 四季花纹 落花流水纹 五福捧寿纹 瓜瓞绵绵纹 岁寒三友纹 福寿双全纹 喜上眉梢纹 连生贵子纹
  Return empty array only if absolutely no patterns visible.

ICH categories (pick the closest one, return ONLY the category name without prefix):
刺绣: 苏绣, 湘绣, 蜀绣, 粤绣, 京绣, 杭绣, 顾绣, 苗绣
陶瓷: 青花瓷, 唐三彩, 紫砂陶, 龙泉青瓷, 景德镇瓷, 德化白瓷
雕塑: 木雕, 玉雕, 石雕, 竹雕, 泥塑, 面塑
织造: 云锦, 宋锦, 蜀锦, 壮锦, 缂丝
金属: 景泰蓝, 苗银, 金银细工, 铁画
纸艺: 剪纸, 皮影, 年画, 木版年画, 灯笼
绘画: 敦煌壁画, 国画, 书法, 篆刻, 唐卡
其他: 蓝印花布, 京剧脸谱, 漆器, 竹编, 风筝, 傩面具"""


def _parse_response(raw_text: str, image_path: str) -> dict:
    """Parse Qwen-VL JSON response, filter low-confidence results"""
    text = raw_text.strip()
    # Remove possible markdown code block markers
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning(f"JSON parse failed, using raw text: {text[:200]}")
        data = {
            "category": UNKNOWN_CATEGORY,
            "confidence": 0.0,
            "top3": [],
            "features": [],
            "description": raw_text,
        }

    category = data.get("category", UNKNOWN_CATEGORY)
    confidence = float(data.get("confidence", 0.0))

    # Low confidence -> mark as unknown
    if confidence < CONFIDENCE_THRESHOLD and category != UNKNOWN_CATEGORY:
        logger.info(f"Confidence {confidence} below threshold {CONFIDENCE_THRESHOLD}, marking as unknown")
        category = UNKNOWN_CATEGORY
        confidence = 0.0
        top3 = []
        features = []
        pattern_names = []
    else:
        top3 = data.get("top3", [])
        features = data.get("features", [])
        pattern_names = data.get("pattern_names", [])

    return {
        "category": category,
        "confidence": confidence,
        "top3": top3,
        "features": features,
        "pattern_names": pattern_names if isinstance(pattern_names, list) else [],
        "raw_description": data.get("description", raw_text),
    }


def _mock_response(image_path: str) -> dict:
    """Generate mock recognition result based on filename match"""
    filename = Path(image_path).stem.lower()
    mock_map = {
        "suxiu": ("苏绣", ["平针绣", "乱针绣", "双面绣"], ["缠枝纹", "牡丹纹", "祥云纹"]),
        "cixiu": ("刺绣", ["平绣", "打籽绣", "盘金绣"], ["莲花纹", "蝴蝶纹", "团花纹"]),
        "jianzhi": ("剪纸", ["阴刻", "阳刻", "套色"], ["回纹", "梅花纹", "方胜纹"]),
        "taoci": ("陶瓷", ["拉坯", "施釉", "青花"], ["回纹", "水波纹", "卷草纹"]),
        "piying": ("皮影", ["雕刻", "染色", "表演"], ["如意纹", "祥云纹", "龙纹"]),
        "zishahu": ("紫砂壶", ["拍身筒", "明针", "镶身筒"], ["回纹", "竹纹", "冰裂纹"]),
    }

    for key, (cat, features, pattern_names) in mock_map.items():
        if key in filename:
            return {
                "category": cat,
                "confidence": 0.92,
                "top3": [
                    {"category": cat, "confidence": 0.92},
                    {"category": "剪纸" if cat != "剪纸" else "皮影", "confidence": 0.05},
                    {"category": "年画", "confidence": 0.03},
                ],
                "features": features,
                "pattern_names": pattern_names,
                "raw_description": f"A beautiful {cat} artwork",
            }

    # Default fallback
    return {
        "category": "苏绣",
        "confidence": 0.85,
        "top3": [
            {"category": "苏绣", "confidence": 0.85},
            {"category": "湘绣", "confidence": 0.10},
            {"category": "蜀绣", "confidence": 0.05},
        ],
        "features": ["平针绣", "套针", "抢针"],
        "pattern_names": ["缠枝纹", "牡丹纹", "蝴蝶纹"],
        "raw_description": "A traditional Chinese embroidery artwork",
    }
