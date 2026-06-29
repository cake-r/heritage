"""AI服务层测试 (Mock模式)"""

import os
import pytest

# 设置Mock模式
os.environ["MOCK_MODE"] = "true"


def test_mock_recognition():
    from app.services.ai.recognition import recognize, UNKNOWN_CATEGORY
    result = recognize("test_image.jpg")
    assert "category" in result
    assert "confidence" in result
    assert "features" in result
    assert isinstance(result["features"], list)
    # Random image without known filename should be rejected (UNKNOWN_CATEGORY)
    assert result["category"] == UNKNOWN_CATEGORY
    assert result["confidence"] == 0.0


def test_mock_llm_chat():
    from app.services.ai.llm import chat
    messages = [{"role": "user", "content": "你好"}]
    result = chat(messages)
    assert isinstance(result, str)
    assert len(result) > 0


def test_mock_llm_stream():
    from app.services.ai.llm import chat_stream
    messages = [{"role": "user", "content": "你好"}]
    tokens = list(chat_stream(messages))
    assert len(tokens) > 0


def test_mock_explanation():
    from app.services.ai.llm import generate_explanation
    result = generate_explanation("苏绣", ["平针绣", "套针"], "一幅绣品")
    assert "history" in result
    assert "technique" in result
    assert "inheritor" in result
    assert "meaning" in result


def test_mock_text_to_image():
    from app.services.ai.image_gen import text_to_image
    result = text_to_image("test prompt", count=2)
    assert "images" in result
    assert "seed" in result
    assert len(result["images"]) == 2


def test_mock_image_to_image():
    from app.services.ai.image_gen import image_to_image
    result = image_to_image("test.jpg", "test prompt", count=2)
    assert "images" in result
    assert len(result["images"]) == 2


def test_mock_tts():
    from app.services.ai.tts import synthesize
    result = synthesize("测试语音合成")
    assert isinstance(result, str)
    assert result.startswith("/static/voices/")


def test_prompt_builder():
    from app.services.ai.prompt_builder import build_creation_prompt
    prompt = build_creation_prompt(
        base_style="苏绣",
        elements=["祥云纹", "青花配色"],
        color_palette="",
        composition="中心对称",
        intensity=0.7,
    )
    assert "苏绣" in prompt
    assert "祥云" in prompt
    assert "中心对称" in prompt


def test_prompt_builder_all_styles():
    from app.services.ai.prompt_builder import build_creation_prompt
    styles = ["剪纸", "苏绣", "皮影", "蓝印花布", "年画", "唐三彩", "青花瓷", "京剧脸譜", "敦煌", "苗银"]
    for style in styles:
        prompt = build_creation_prompt(base_style=style)
        assert len(prompt) > 0, f"Style {style} returned empty prompt"


def test_mock_recognition_filename_match():
    from app.services.ai.recognition import recognize
    result = recognize("suxiu_sample.jpg")
    assert result["category"] == "苏绣"

    result = recognize("jianzhi_test.png")
    assert result["category"] == "剪纸"
