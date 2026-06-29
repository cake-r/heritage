"""生成高质量非遗藏品展示图片

由于 Wikimedia/Wikipedia/百度百科等外部图片源在当前网络环境下无法访问，
此脚本使用 PIL 生成具有传统美学风格的占位图片。

特点:
- 传统国风配色（每个品类有独特的主题色）
- 装饰性边框和纹样
- 清晰的中文排版
- 视觉层次分明

用法:
    python scripts/generate_better_images.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "data" / "uploads" / "knowledge"
HERITAGE_FILE = Path(__file__).resolve().parent.parent / "data" / "knowledge" / "heritage_sample.json"

# 每个品类的主题配色
CATEGORY_COLORS = {
    "刺绣": ("#8B1A2B", "#F5EDE3", "#C9A96E"),      # 深红、暖米、金
    "陶瓷": ("#1A5276", "#F0F3F5", "#85C1E9"),         # 深蓝、灰白、浅蓝
    "雕塑": ("#5D4037", "#F5F0EB", "#A1887F"),         # 深棕、米白、浅棕
    "织锦": ("#6C3483", "#F5EEF8", "#D2B4DE"),         # 深紫、浅紫、淡紫
    "金属": ("#7D6608", "#FEF9E7", "#F9E79F"),         # 暗金、浅金、淡金
    "漆器": ("#943126", "#FDEDEC", "#F1948A"),         # 深朱、浅粉、淡红
    "剪纸": ("#C0392B", "#FFF5F5", "#F8C471"),         # 红色、浅红、金色
    "皮影": ("#935116", "#FDF2E9", "#EDBB99"),         # 深棕、暖白、浅棕
    "年画": ("#B71C1C", "#FFF8E1", "#FFCC02"),         # 大红、米黄、亮黄
    "蓝印花布": ("#1A3C6D", "#F0F4FA", "#5DADE2"),     # 靛蓝、浅蓝、亮蓝
    "竹编": ("#558B2F", "#F1F8E9", "#AED581"),         # 竹绿、浅绿、亮绿
    "书法": ("#212121", "#FAFAFA", "#9E9E9E"),         # 墨黑、纯白、灰色
    "篆刻": ("#BF360C", "#FBE9E7", "#FF8A65"),         # 朱砂红、浅红、橘红
    "泥塑": ("#8D6E63", "#F5F0EB", "#BCAAA4"),         # 土棕、米白、浅灰棕
    "戏曲": ("#D32F2F", "#FFEBEE", "#EF9A9A"),         # 戏曲红、浅粉、淡红
    "民间美术": ("#E65100", "#FFF3E0", "#FFB74D"),     # 橙色、浅橙、亮橙
    "唐三彩": ("#E67E22", "#FDEBD0", "#FAD7A1"),       # 橙褐、淡黄、杏色
    "紫砂": ("#6D4C41", "#F5F0EB", "#A1887F"),         # 紫砂棕、米白、浅棕
    "其他": ("#546E7A", "#ECEFF1", "#B0BEC5"),         # 蓝灰、浅灰、亮灰
}


def get_font(size: int) -> ImageFont.FreeTypeFont:
    """获取中文字体"""
    font_paths = [
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simsun.ttc",
        "C:/Windows/Fonts/simkai.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                continue
    return ImageFont.load_default()


def draw_decorative_border(draw: ImageDraw.ImageDraw, w: int, h: int, colors: tuple):
    """绘制传统装饰边框"""
    primary, bg, accent = colors
    # 外框
    draw.rectangle([8, 8, w - 9, h - 9], outline=primary, width=3)
    # 内框
    draw.rectangle([20, 20, w - 21, h - 21], outline=accent, width=1)
    # 角饰
    corner_size = 40
    for cx, cy in [(24, 24), (w - 25, 24), (24, h - 25), (w - 25, h - 25)]:
        draw.rectangle([cx, cy, cx + corner_size, cy + 3], fill=primary)
        draw.rectangle([cx, cy, cx + 3, cy + corner_size], fill=primary)


def draw_pattern(draw: ImageDraw.ImageDraw, w: int, h: int, accent: str):
    """绘制底纹图案"""
    # 简单的菱形底纹
    spacing = 60
    for x in range(0, w + spacing, spacing):
        for y in range(0, h + spacing, spacing):
            if (x // spacing + y // spacing) % 2 == 0:
                draw.rectangle(
                    [x - 10, y, x, y + 10],
                    fill=accent + "10"  # 极淡
                )


def generate_image(name: str, category: str, filepath: Path):
    """生成精美的非遗展示图片"""
    W, H = 900, 675
    colors = CATEGORY_COLORS.get(category, CATEGORY_COLORS["其他"])
    primary, bg, accent = colors

    # 创建底图
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)

    # 底纹
    draw_pattern(draw, W, H, accent)

    # 装饰边框
    draw_decorative_border(draw, W, H, colors)

    # 顶部色带
    draw.rectangle([0, 0, W, 120], fill=primary + "20")  # 10% opacity equivalent

    # 分类标签（顶部居中）
    cat_font = get_font(20)
    cat_text = f"国家级非物质文化遗产 · {category}"
    cat_bbox = draw.textbbox((0, 0), cat_text, font=cat_font)
    cat_w = cat_bbox[2] - cat_bbox[0]
    draw.text(((W - cat_w) // 2, 40), cat_text, fill=primary, font=cat_font)

    # 主标题
    title_font = get_font(64)
    title_bbox = draw.textbbox((0, 0), name, font=title_font)
    title_w = title_bbox[2] - title_bbox[0]
    title_h = title_bbox[3] - title_bbox[1]
    title_x = (W - title_w) // 2
    title_y = (H - title_h) // 2 - 30
    draw.text((title_x, title_y), name, fill=primary, font=title_font)

    # 标题下方装饰线
    line_y = title_y + title_h + 20
    draw.line([(W // 3, line_y), (2 * W // 3, line_y)], fill=accent, width=2)
    draw.ellipse([W // 2 - 5, line_y - 5, W // 2 + 5, line_y + 5], fill=accent)

    # 副标题（英文/拼音）
    sub_font = get_font(18)
    sub_text = "Intangible Cultural Heritage"
    sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    sub_w = sub_bbox[2] - sub_bbox[0]
    draw.text(((W - sub_w) // 2, line_y + 20), sub_text, fill=accent, font=sub_font)

    # 底部信息栏
    footer_y = H - 80
    draw.rectangle([0, footer_y, W, H], fill=primary + "08")

    footer_font = get_font(16)
    footer_text = "非遗数字交互与文创生成系统 · 数字展厅"
    footer_bbox = draw.textbbox((0, 0), footer_text, font=footer_font)
    footer_w = footer_bbox[2] - footer_bbox[0]
    draw.text(((W - footer_w) // 2, footer_y + 30), footer_text, fill=primary, font=footer_font)

    # 微微模糊底纹增加质感
    img = img.filter(ImageFilter.GaussianBlur(0.5))

    # 保存
    filepath.parent.mkdir(parents=True, exist_ok=True)
    img.save(filepath, "JPEG", quality=92)
    print(f"  OK: {filepath.name}")


def main():
    print("=" * 60)
    print("High-quality Heritage Placeholder Image Generator")
    print("=" * 60)

    with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)

    for item in items:
        name = item["name"]
        category = item.get("category", "其他")
        images = item.get("images", [])

        if not images:
            continue

        image_filename = Path(images[0]).name
        filepath = KNOWLEDGE_DIR / image_filename

        # Always regenerate for consistency
        generate_image(name, category, filepath)

    print(f"\nDone: {len(items)} images generated")
    print(f"Directory: {KNOWLEDGE_DIR}")


if __name__ == "__main__":
    main()
