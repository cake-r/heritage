"""I2I 图片工具 — 通万相 wan2.5-i2i-preview 尺寸适配

API 要求：
  - 单边尺寸在 [384, 5000] 之间
  - 总像素在 [589824 (768x768), 1638400 (1280x1280)] 之间

本模块提供统一缩放函数，供 image_gen.py 和 restoration_pipeline.py 共用。
"""

from pathlib import Path
import logging

logger = logging.getLogger("i2i_utils")

# wan2.5-i2i-preview API 单边尺寸约束
I2I_MIN_DIM = 384
I2I_MAX_DIM = 5000

# wan2.5-i2i-preview API 总像素约束
I2I_MIN_PIXELS = 589824   # 768 * 768
I2I_MAX_PIXELS = 1638400  # 1280 * 1280


def _clamp_pixels(w: int, h: int) -> tuple[int, int]:
    """确保总像素在 [I2I_MIN_PIXELS, I2I_MAX_PIXELS] 范围内，等比缩放。

    放大时用 math.ceil 保证达标（避免 int 截断导致尺寸不变，如
    626×941=589066 仅差 758px，int(×1.00064) 截断后仍是 626×941）。"""
    import math

    pixels = w * h
    if pixels < I2I_MIN_PIXELS:
        scale = (I2I_MIN_PIXELS / pixels) ** 0.5
        w2, h2 = math.ceil(w * scale), math.ceil(h * scale)
        logger.info(f"I2I 总像素补足: {w}x{h} ({pixels}px) → {w2}x{h2} ({w2*h2}px)")
        return w2, h2
    if pixels > I2I_MAX_PIXELS:
        scale = (I2I_MAX_PIXELS / pixels) ** 0.5
        w2, h2 = int(w * scale), int(h * scale)
        logger.info(f"I2I 总像素压缩: {w}x{h} ({pixels}px) → {w2}x{h2} ({w2*h2}px)")
        return w2, h2
    return w, h


class I2IDimensionError(ValueError):
    """图片尺寸不满足 I2I API 要求"""


def validate_i2i_input(image_path: str) -> None:
    """上传后第一时间校验图片能否满足 I2I API 要求。

    在管道运行之前调用，不满足直接抛 I2IDimensionError，
    避免浪费损伤分析 / 修复方案生成的时间后再失败。

    Raises:
        I2IDimensionError: 图片经过最大合理放大后仍不满足总像素要求
    """
    import math
    from PIL import Image

    img = Image.open(image_path)
    w, h = img.size

    # 绝对底线：原始图片总像素低于此值，强行放大画质不可接受
    _ABS_MIN_ORIGINAL_PIXELS = 80_000  # 约 283×283
    if w * h < _ABS_MIN_ORIGINAL_PIXELS:
        raise I2IDimensionError(
            f"图片像素严重不足: 当前 {w}×{h}（{w * h} 像素），"
            f"文物修复 AI 要求至少 {_ABS_MIN_ORIGINAL_PIXELS // 1000}k 原始像素"
            f"（最低约 283×283）。请上传分辨率更高的图片。"
        )

    # 模拟 resize_for_i2i 三步缩放后的尺寸
    sim_w, sim_h = w, h
    if sim_w < I2I_MIN_DIM or sim_h < I2I_MIN_DIM:
        scale = I2I_MIN_DIM / min(sim_w, sim_h)
        sim_w, sim_h = math.ceil(sim_w * scale), math.ceil(sim_h * scale)
    if sim_w > I2I_MAX_DIM or sim_h > I2I_MAX_DIM:
        scale = I2I_MAX_DIM / max(sim_w, sim_h)
        sim_w, sim_h = int(sim_w * scale), int(sim_h * scale)

    # 第三步：总像素约束（与 resize_for_i2i 一致）
    sim_w, sim_h = _clamp_pixels(sim_w, sim_h)
    sim_pixels = sim_w * sim_h

    if sim_pixels < I2I_MIN_PIXELS:
        raise I2IDimensionError(
            f"图片像素不足: 当前 {w}×{h}（{w * h} 像素），"
            f"文物修复 AI 要求至少 {I2I_MIN_PIXELS:,} 像素（约 768×768），"
            f"当前图片即使放大后也仅 {sim_w}×{sim_h}（{sim_pixels:,} 像素）。"
            f"请上传分辨率更高的图片。"
        )

    if sim_pixels > I2I_MAX_PIXELS:
        raise I2IDimensionError(
            f"图片像素超标: 当前 {w}×{h}（{w * h:,} 像素），"
            f"文物修复 AI 限制最多 {I2I_MAX_PIXELS:,} 像素（约 1280×1280），"
            f"当前图片缩放后达 {sim_w}×{sim_h}（{sim_pixels:,} 像素）。"
            f"请上传分辨率稍低的图片。"
        )


def get_i2i_output_size(image_path: str) -> str:
    """根据输入图片的宽高比计算 I2I 输出尺寸。

    保证同时满足：单边 [384, 5000] + 总像素 [589824, 1638400]。
    返回 "W*H" 格式字符串。
    """
    from PIL import Image

    img = Image.open(image_path)
    w, h = img.size

    # Step 1: 单边约束等比缩放至 [384, 5000]
    if w < I2I_MIN_DIM or h < I2I_MIN_DIM:
        scale = I2I_MIN_DIM / min(w, h)
        w, h = int(w * scale), int(h * scale)
    if w > I2I_MAX_DIM or h > I2I_MAX_DIM:
        scale = I2I_MAX_DIM / max(w, h)
        w, h = int(w * scale), int(h * scale)

    # Step 2: 总像素约束等比缩放
    w, h = _clamp_pixels(w, h)

    logger.info(f"I2I 输出尺寸: {w}*{h} (匹配输入图片比例)")
    return f"{w}*{h}"


def resize_for_i2i(image_path: str) -> str:
    """确保图片尺寸满足 wan2.5-i2i-preview 的全部要求。

    三步处理：
    1. 单边 < 384 → 等比放大至短边=384
    2. 单边 > 5000 → 等比缩小至长边=5000
    3. 总像素不足 589824 或超出 1638400 → 等比补足/压缩

    返回（可能已调整大小的）图片路径。
    """
    from PIL import Image

    img = Image.open(image_path).convert("RGB")
    orig_w, orig_h = img.size

    need_resize = False
    target_w, target_h = orig_w, orig_h

    # Step 1: 单边下限 — 短边不足 384 则等比放大
    if target_w < I2I_MIN_DIM or target_h < I2I_MIN_DIM:
        scale = I2I_MIN_DIM / min(target_w, target_h)
        target_w = int(target_w * scale)
        target_h = int(target_h * scale)
        need_resize = True

    # Step 2: 单边上限 — 长边超出 5000 则等比缩小
    if target_w > I2I_MAX_DIM or target_h > I2I_MAX_DIM:
        scale = I2I_MAX_DIM / max(target_w, target_h)
        target_w = int(target_w * scale)
        target_h = int(target_h * scale)
        need_resize = True

    # Step 3: 总像素约束 — 不足 589824 或超出 1638400 则等比调整
    pixels = target_w * target_h
    if pixels < I2I_MIN_PIXELS or pixels > I2I_MAX_PIXELS:
        target_w, target_h = _clamp_pixels(target_w, target_h)
        need_resize = True

    if not need_resize:
        return image_path

    resized_path = str(Path(image_path).parent / f"_i2i_resized_{Path(image_path).name}")
    img_resized = img.resize((target_w, target_h), Image.LANCZOS)
    img_resized.save(resized_path, quality=95)
    logger.info(
        f"I2I 图片尺寸调整: {orig_w}x{orig_h} → {target_w}x{target_h} "
        f"(API要求 单边[{I2I_MIN_DIM},{I2I_MAX_DIM}] 总像素[{I2I_MIN_PIXELS},{I2I_MAX_PIXELS}])"
    )
    return resized_path
