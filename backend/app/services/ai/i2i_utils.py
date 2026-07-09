"""I2I 图片工具 — 通万相 wan2.5-i2i-preview 尺寸适配

API 要求图片尺寸在 [384, 5000] 之间，本模块提供统一缩放函数，
供 image_gen.py 和 restoration_pipeline.py 共用。
"""

from pathlib import Path
import logging

logger = logging.getLogger("i2i_utils")

# wan2.5-i2i-preview API 要求图片尺寸在 [384, 5000] 之间
I2I_MIN_DIM = 384
I2I_MAX_DIM = 5000


def get_i2i_output_size(image_path: str) -> str:
    """根据输入图片的宽高比计算 I2I 输出尺寸，保持与原图一致的比例。

    返回 "W*H" 格式字符串，两端尺寸均在 [384, 5000] 范围内。
    """
    from PIL import Image

    img = Image.open(image_path)
    w, h = img.size

    # 等比缩放至 [384, 5000] 区间（逻辑与 resize_for_i2i 一致）
    if w < I2I_MIN_DIM or h < I2I_MIN_DIM:
        scale = I2I_MIN_DIM / min(w, h)
        w, h = int(w * scale), int(h * scale)
    if w > I2I_MAX_DIM or h > I2I_MAX_DIM:
        scale = I2I_MAX_DIM / max(w, h)
        w, h = int(w * scale), int(h * scale)

    logger.info(f"I2I 输出尺寸: {w}*{h} (匹配输入图片比例)")
    return f"{w}*{h}"


def resize_for_i2i(image_path: str) -> str:
    """确保图片尺寸满足 wan2.5-i2i-preview 的 [384, 5000] 要求。

    如果任一边不满足，等比缩放到短边=384（放大）或长边=5000（缩小）。
    返回（可能已调整大小的）图片路径。
    """
    from PIL import Image

    img = Image.open(image_path).convert("RGB")
    orig_w, orig_h = img.size

    need_resize = False
    target_w, target_h = orig_w, orig_h

    if orig_w < I2I_MIN_DIM or orig_h < I2I_MIN_DIM:
        scale = I2I_MIN_DIM / min(orig_w, orig_h)
        target_w = int(orig_w * scale)
        target_h = int(orig_h * scale)
        need_resize = True

    if target_w > I2I_MAX_DIM or target_h > I2I_MAX_DIM:
        scale = I2I_MAX_DIM / max(target_w, target_h)
        target_w = int(target_w * scale)
        target_h = int(target_h * scale)
        need_resize = True

    if not need_resize:
        return image_path

    resized_path = str(Path(image_path).parent / f"_i2i_resized_{Path(image_path).name}")
    img_resized = img.resize((target_w, target_h), Image.LANCZOS)
    img_resized.save(resized_path, quality=95)
    logger.info(
        f"I2I 图片尺寸调整: {orig_w}x{orig_h} → {target_w}x{target_h} "
        f"(API要求 [{I2I_MIN_DIM}, {I2I_MAX_DIM}])"
    )
    return resized_path
