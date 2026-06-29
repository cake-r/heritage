"""语音合成服务 — CosyVoice V1 (DashScope) + Mock支持"""

import os
import logging
from pathlib import Path

from app.services.ai.base import with_retry, AIServiceError, mock_mode
from app.config import VOICE_DIR

logger = logging.getLogger("tts")

# 默认音色 (CosyVoice V1 预设音色)
DEFAULT_VOICE = os.getenv("COSYVOICE_VOICE", "longxiaochun")
# 北京地域 WebSocket 端点
DASHSCOPE_WS_URL = "wss://dashscope.aliyuncs.com/api-ws/v1/inference"


@with_retry(max_retries=2, base_delay=1.0, timeout=90)
def synthesize(text: str, speed: float = 1.0) -> str:
    """
    文本转语音

    Args:
        text: 要合成的文本
        speed: 语速倍率 (0.5 / 1.0 / 1.5)

    Returns:
        本地音频文件路径: /static/voices/xxx.wav
    """
    if mock_mode():
        logger.info(f"Mock模式: TTS text={text[:30]}...")
        return _mock_synthesize(text)

    api_key = os.getenv("DASHSCOPE_API_KEY", "")
    if not api_key:
        raise AIServiceError("DASHSCOPE_API_KEY 未配置", service="CosyVoice", retryable=False)

    try:
        import dashscope
        from dashscope.audio.tts_v2 import SpeechSynthesizer, AudioFormat

        dashscope.api_key = api_key
        dashscope.base_websocket_api_url = DASHSCOPE_WS_URL

        synthesizer = SpeechSynthesizer(
            model="cosyvoice-v1",
            voice=DEFAULT_VOICE,
            format=AudioFormat.WAV_24000HZ_MONO_16BIT,
            volume=50,
            speech_rate=float(speed),
            pitch_rate=1.0,
        )

        audio_data = synthesizer.call(text)

        if not audio_data:
            raise AIServiceError("TTS返回空音频数据", service="CosyVoice", retryable=True)

        # 保存音频文件
        import hashlib
        filename = f"{hashlib.md5(text.encode()).hexdigest()[:12]}.wav"
        filepath = VOICE_DIR / filename
        VOICE_DIR.mkdir(parents=True, exist_ok=True)

        with open(filepath, "wb") as f:
            f.write(audio_data)

        logger.info(f"TTS合成成功: {filepath} ({len(audio_data)} bytes)")
        return f"/static/voices/{filename}"

    except ImportError:
        raise AIServiceError("dashscope SDK未安装", service="CosyVoice", retryable=False)
    except AIServiceError:
        raise
    except Exception as e:
        raise AIServiceError(str(e), service="CosyVoice")


def _mock_synthesize(text: str) -> str:
    """Mock TTS — 返回预合成音频或空文件"""
    mock_dir = Path(__file__).resolve().parent.parent.parent.parent / "data" / "mock" / "tts_samples"
    if mock_dir.exists():
        samples = list(mock_dir.glob("*.wav")) + list(mock_dir.glob("*.mp3"))
        if samples:
            return f"/static/voices/{samples[0].name}"

    # 没有预合成文件, 返回空占位
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    placeholder = VOICE_DIR / "placeholder.wav"
    if not placeholder.exists():
        placeholder.touch()
    return "/static/voices/placeholder.wav"
