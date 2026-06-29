"""大语言模型服务 — DeepSeek-V3 + Mock支持"""

import json
import os
import logging
from typing import Generator

from app.services.ai.base import with_retry, AIServiceError, mock_mode, load_mock

logger = logging.getLogger("llm")


@with_retry(max_retries=3, base_delay=1.0, timeout=60)
def chat(messages: list[dict], stream: bool = False) -> str:
    """
    调用DeepSeek对话

    Args:
        messages: [{"role":"system|user|assistant","content":"..."}]
        stream: 是否流式 (True时返回Generator)

    Returns:
        AI回复文本 (stream=False)
    """
    if mock_mode():
        logger.info("Mock模式: LLM对话")
        chat_demo = load_mock("chat_demo.json")
        if chat_demo:
            return chat_demo[-1]["content"] if isinstance(chat_demo, list) else str(chat_demo)
        return "这是一段Mock回复：非遗文化是中华文明的重要组成部分..."

    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise AIServiceError("DEEPSEEK_API_KEY 未配置", service="DeepSeek", retryable=False)

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=api_key,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        )

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )

        return response.choices[0].message.content

    except ImportError:
        raise AIServiceError("openai SDK未安装", service="DeepSeek", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        raise AIServiceError(str(e), service="DeepSeek")


def chat_stream(messages: list[dict]) -> Generator[str, None, None]:
    """
    DeepSeek流式对话 — 逐token返回

    Yields:
        str: 每个token的文本片段
    """
    if mock_mode():
        logger.info("Mock模式: 流式对话")
        mock_text = "这是非遗文化的精彩故事。让我慢慢为你讲述这段历史..."
        for i in range(0, len(mock_text), 3):
            import time
            time.sleep(0.05)
            yield mock_text[i:i+3]
        return

    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        raise AIServiceError("DEEPSEEK_API_KEY 未配置", service="DeepSeek", retryable=False)

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=api_key,
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        )

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
            stream=True,
        )

        for chunk in response:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except ImportError:
        raise AIServiceError("openai SDK未安装", service="DeepSeek", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        raise AIServiceError(str(e), service="DeepSeek")


def generate_explanation(category: str, features: list[str], raw_description: str) -> dict:
    """
    根据识别结果生成4段详细讲解

    Returns:
        {"history": "...", "technique": "...", "inheritor": "...", "meaning": "..."}
    """
    # 无法识别时返回提示信息
    if category == "无法识别":
        return {
            "history": "未能识别该图片中的非遗品类。请上传中国传统手工艺品的清晰图片，如刺绣、陶瓷、剪纸、皮影等。",
            "technique": "系统目前支持识别苏绣、湘绣、剪纸、皮影、唐三彩、青花瓷、紫砂陶、景泰蓝、苗银、年画、蓝印花布、敦煌壁画等18种非遗品类。",
            "inheritor": "欢迎探索中国非物质文化遗产的丰富世界。您可以浏览数字展厅了解更多非遗文化。",
            "meaning": "非物质文化遗产是中华民族智慧的结晶，承载着丰富的历史信息和文化基因。建议上传非遗作品图片以获得准确识别。",
        }

    if mock_mode():
        return {
            "history": f"{category}是中国传统工艺美术的瑰宝，历史悠久，源远流长。其发源可追溯至古代，经过千百年的传承与发展，形成了独特的艺术风格和文化内涵。",
            "technique": f"{category}的制作工艺极为精湛。{', '.join(features[:3]) if features else '其核心技法'}体现了匠人的智慧与创造力，每一道工序都蕴含着深厚的文化积淀。",
            "inheritor": f"当代{category}的传承人中，有多位国家级非物质文化遗产代表性传承人。他们数十年如一日地坚守传统技艺，同时不断创新，让古老的手艺焕发新的生机。",
            "meaning": f"{category}不仅是一件手工艺品，更承载着中华民族的文化记忆与审美理想。它寄托了人们对美好生活的向往，是中华文明核心理念的生动表达。",
        }

    prompt = f"""你是中国非物质文化遗产研究专家。请为"{category}"撰写四部分详细讲解。

识别特征: {', '.join(features) if features else '标准特征'}
视觉描述: {raw_description}

请严格按JSON格式返回:
{{
  "history": "历史渊源 (200-300字, 讲述起源、发展、鼎盛时期)",
  "technique": "制作工艺 (200-300字, 核心技法、工艺流程、技术难点)",
  "inheritor": "传承人故事 (150-200字, 代表性传承人及其贡献)",
  "meaning": "文化寓意 (150-200字, 社会价值、文化象征、精神内涵)"
}}"""

    messages = [{"role": "user", "content": prompt}]
    text = chat(messages)

    # 解析JSON
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "history": text[:400],
            "technique": "",
            "inheritor": "",
            "meaning": "",
        }
