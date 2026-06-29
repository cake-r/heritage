"""Prompt Engineering — 结构化参数 → 完整生图Prompt"""

# 风格 → 视觉描述映射
STYLE_MAP = {
    "剪纸": "中国剪纸艺术风格，红色纸张剪裁质感，镂空图案，对称构图，民间传统纹样，平面化设计",
    "苏绣": "苏绣丝绸质感，精细刺绣纹理，江南水乡韵味，柔和典雅配色，丝线光泽，细腻针法肌理",
    "皮影": "传统皮影戏风格，牛皮雕刻质感，透光效果，关节可动结构，民间戏曲人物造型，浓郁色彩",
    "蓝印花布": "蓝印花布印染风格，靛蓝底色配白色花纹，民间印染图案，棉布质感，传统吉祥纹样",
    "年画": "中国传统年画风格，喜庆热烈的红金配色，民间吉祥图案，木版印刷质感，饱满构图",
    "唐三彩": "唐三彩陶瓷风格，黄绿白三色釉彩交融，釉色流淌效果，唐代雍容华贵审美，陶器光泽",
    "青花瓷": "青花瓷风格，钴蓝色手绘纹样，白釉底色，典雅清丽，瓷器光泽，传统花卉图案",
    "京剧脸譜": "京剧脸谱艺术风格，鲜艳色彩搭配，夸张面部图案，戏曲装饰元素，红黑白主色调",
    "敦煌": "敦煌壁画风格，飞天仙女图案，矿物颜料色彩，斑驳复古质感，西域与中原文化交融",
    "苗银": "苗族银饰锻造风格，繁复银饰纹理，几何图案，少数民族审美，银质光泽，精致手工感",
}

# 元素 → 视觉描述映射
ELEMENT_MAP = {
    "祥云纹": "融入传统祥云纹样，流线型云纹装饰",
    "牡丹花": "以牡丹花为主题元素，国色天香，雍容华贵",
    "回纹边框": "添加传统回纹边框，几何纹样装饰",
    "龙纹": "包含中国传统龙纹图案，威严气派",
    "凤纹": "包含凤凰纹样，吉祥高贵",
    "青花配色": "使用钴蓝色为主色调，白底蓝花配色方案",
    "敦煌配色": "使用敦煌壁画经典配色：赭红、石绿、土黄、深蓝",
    "景泰蓝配色": "使用景泰蓝掐丝珐琅色彩：宝石蓝、翡翠绿、珊瑚红",
    "水墨风": "采用中国传统水墨画风格，黑白灰渐变，写意笔触",
}

# 构图 → 视觉描述映射
COMPOSITION_MAP = {
    "中心对称": "中心对称构图，主体居中，左右对称平衡",
    "散点透视": "中国画散点透视构图，多视角展开",
    "长卷式": "长卷式构图，横幅展开，叙事性画面",
    "团扇式": "圆形团扇式构图，框景设计",
    "留白": "大量留白处理，计白当黑，虚实相生",
}


def build_creation_prompt(
    base_style: str,
    elements: list[str] | None = None,
    color_palette: str = "",
    composition: str = "",
    intensity: float = 0.7,
) -> str:
    """
    将结构化参数组装为完整生图Prompt

    Args:
        base_style: 基础风格 (剪纸/苏绣/皮影/...)
        elements: 额外元素列表
        color_palette: 配色方案
        composition: 构图方式
        intensity: 风格融合强度 (0-1)

    Returns:
        完整的英文prompt (通义万相英文效果更好)
    """
    parts = []

    # 风格主体
    style_desc = STYLE_MAP.get(base_style, f"{base_style}中国传统艺术风格")
    parts.append(style_desc)

    # 强度表述
    if intensity >= 0.8:
        parts.append("fully rendered in this style, highly detailed")
    elif intensity >= 0.5:
        parts.append("blended with this style influence, balanced artistic interpretation")
    else:
        parts.append("lightly infused with this style, subtle reference")

    # 元素
    if elements:
        for elem in elements:
            if elem in ELEMENT_MAP:
                parts.append(ELEMENT_MAP[elem])
            else:
                parts.append(elem)

    # 配色
    if color_palette and color_palette in ELEMENT_MAP:
        parts.append(ELEMENT_MAP[color_palette])
    elif color_palette:
        parts.append(f"使用{color_palette}配色方案")

    # 构图
    if composition and composition in COMPOSITION_MAP:
        parts.append(COMPOSITION_MAP[composition])
    elif composition:
        parts.append(f"{composition}构图")

    # 质量词
    parts.append("high quality, exquisite craftsmanship, cultural heritage artwork, professional photography, 4K, detailed texture")

    # 技术提示 (英文效果好)
    prompt = ", ".join(parts)

    # 如果是明显国风, 加中文提示词增强
    prompt += ", Chinese traditional art, intangible cultural heritage, guochao style"

    return prompt


def build_negative_prompt(user_negative: str = "") -> str:
    """组装负向提示词"""
    base_negative = "low quality, blurry, distorted, ugly, bad anatomy, watermark, text, logo, oversaturated, western style, photorealistic, 3D render, plastic feeling"
    if user_negative:
        return f"{base_negative}, {user_negative}"
    return base_negative
