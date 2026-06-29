"""Image recognition service — Qwen-VL-Max (DashScope) + Mock support"""

import json
import logging
import base64
import os
from pathlib import Path

from app.services.ai.base import with_retry, AIServiceError, mock_mode, load_mock

logger = logging.getLogger("recognition")

# Confidence threshold — results below this are considered unreliable
CONFIDENCE_THRESHOLD = 0.6
# Category returned when recognition fails
UNKNOWN_CATEGORY = "无法识别"


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
        # Try filename match first
        matched = _mock_response(image_path)
        filename = Path(image_path).stem.lower()
        known_keys = ["suxiu", "cixiu", "jianzhi", "taoci", "piying", "zishahu"]
        if any(k in filename for k in known_keys):
            return matched
        # No match — return unknown instead of random guess
        logger.info("Mock mode: no match found, returning unknown")
        return {
            "category": UNKNOWN_CATEGORY,
            "confidence": 0.0,
            "top3": [],
            "features": [],
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
            raise AIServiceError(
                f"API error: {response.code} - {response.message}",
                service="Qwen-VL"
            )

        raw_text = response.output.choices[0].message.content[0]["text"]
        return _parse_response(raw_text, image_path)

    except ImportError:
        raise AIServiceError("dashscope SDK not installed: pip install dashscope", service="Qwen-VL", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        raise AIServiceError(str(e), service="Qwen-VL")


def _build_recognition_prompt() -> str:
    return """Please identify whether this image belongs to a Chinese Intangible Cultural Heritage category.

**IMPORTANT: If the image is NOT a Chinese traditional handicraft (e.g., modern objects, landscapes, portraits, buildings, animals, etc.), you MUST return category="无法识别" and confidence=0.**

Return strictly in JSON format:
{
  "category": "ICH category name, or '无法识别' if not ICH",
  "confidence": 0.95,
  "top3": [
    {"category": "category1", "confidence": 0.95},
    {"category": "category2", "confidence": 0.03},
    {"category": "category3", "confidence": 0.02}
  ],
  "features": ["feature1", "feature2", "feature3"],
  "description": "Detailed visual description including patterns, techniques, materials, colors, style era"
}

ICH categories: 苏绣, 湘绣, 蜀绣, 粤绣, 剪纸, 皮影, 年画, 蓝印花布, 唐三彩, 青花瓷, 紫砂陶, 京剧脸谱, 敦煌壁画, 苗银, 景泰蓝, 木版年画, 书法, 篆刻"""


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
    else:
        top3 = data.get("top3", [])
        features = data.get("features", [])

    return {
        "category": category,
        "confidence": confidence,
        "top3": top3,
        "features": features,
        "raw_description": data.get("description", raw_text),
    }


def _mock_response(image_path: str) -> dict:
    """Generate mock recognition result based on filename match"""
    filename = Path(image_path).stem.lower()
    mock_map = {
        "suxiu": ("苏绣", ["平针绣", "乱针绣", "双面绣"]),
        "cixiu": ("刺绣", ["平绣", "打籽绣", "盘金绣"]),
        "jianzhi": ("剪纸", ["阴刻", "阳刻", "套色"]),
        "taoci": ("陶瓷", ["拉坯", "施釉", "青花"]),
        "piying": ("皮影", ["雕刻", "染色", "表演"]),
        "zishahu": ("紫砂壶", ["拍身筒", "明针", "镶身筒"]),
    }

    for key, (cat, features) in mock_map.items():
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
        "raw_description": "A traditional Chinese embroidery artwork",
    }
