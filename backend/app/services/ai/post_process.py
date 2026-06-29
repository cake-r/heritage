"""热力图后处理 — OpenCV生成伪热力图蒙版"""

import uuid
import logging
from pathlib import Path

import cv2
import numpy as np

from app.config import HEATMAP_DIR

logger = logging.getLogger("post_process")

# 特征关键词 → 视觉标注文案
FEATURE_LABELS: dict[str, str] = {
    "平针绣": "平针绣法区域 — 平整均匀的长线走势",
    "乱针绣": "乱针绣法区域 — 交错层叠的色彩调和",
    "双面绣": "双面绣区域 — 正反两面皆可见精美纹样",
    "套针": "套针技法区域 — 分层递进的色彩过渡",
    "抢针": "抢针技法区域 — 短针抢色的渐变效果",
    "打籽绣": "打籽绣区域 — 点状密集的立体颗粒质感",
    "盘金绣": "盘金绣区域 — 金色线盘绕的装饰纹路",
    "阴刻": "阴刻镂空区域 — 线条内凹的剪影造型",
    "阳刻": "阳刻连接区域 — 线条保留的主体轮廓",
    "套色": "套色叠加区域 — 多层彩色叠纸工艺",
    "拉坯": "拉坯成型痕迹 — 轮制圆器的旋纹特征",
    "施釉": "釉面特征区域 — 色彩流动与光泽变化",
    "青花": "青花绘制区域 — 钴蓝彩绘的纹饰焦点",
    "雕刻": "雕刻镂空区域 — 精细刀工的纹理表现",
    "染色": "染色渐变区域 — 矿物颜料层叠的色阶",
    "拍身筒": "拍身筒成型 — 泥片拍打成型的接合痕迹",
    "明针": "明针处理区域 — 表面光滑的精密修整",
}


def generate_heatmap(
    image_path: str,
    features: list[str],
    category: str = "",
) -> tuple[str, list[dict]]:
    """
    生成AI分析风格的热力图蒙版

    Args:
        image_path: 原图路径
        features: 特征关键词列表
        category: 非遗品类名称

    Returns:
        (heatmap_url, feature_positions)
        heatmap_url: 生成的热力图访问URL
        feature_positions: [{name, x, y, label}] 用于前端hover交互
    """
    img = cv2.imread(image_path)
    if img is None:
        logger.warning(f"无法读取图片: {image_path}, 使用空白图")
        img = np.ones((400, 400, 3), dtype=np.uint8) * 200

    h, w = img.shape[:2]
    n_features = len(features) if features else 3
    if n_features == 0:
        # fallback
        disp_features = ["关键纹样", "技法特征", "材质纹理"]
        n_features = 3
    else:
        disp_features = features[:]

    # 计算热点位置 — 基于图像内容分析检测显著区域
    positions = _compute_salient_positions(img, n_features)

    # 创建热力图底版 (单通道灰度)
    heatmap_gray = np.zeros((h, w), dtype=np.float32)

    # 对每个特征位置叠加高斯热斑
    base_sigma = min(w, h) / 8.0
    for i, (cx, cy) in enumerate(positions):
        sigma = base_sigma * (1.0 + i * 0.3)  # 各特征区域大小稍有变化
        intensity = 1.0 - i * 0.08  # 强度递减
        _add_gaussian_spot(heatmap_gray, cx, cy, sigma, intensity=intensity)

    # 加上一层整体弱热力 (让整图有AI分析的"热感")
    overall = np.ones((h, w), dtype=np.float32) * 0.15
    # 边缘衰减
    y, x = np.ogrid[:h, :w]
    edge_mask = np.minimum(
        np.minimum(x / (w * 0.15), (w - x) / (w * 0.15)),
        np.minimum(y / (h * 0.15), (h - y) / (h * 0.15)),
    )
    edge_mask = np.clip(edge_mask, 0, 1)
    overall = overall * edge_mask
    heatmap_gray = np.clip(heatmap_gray + overall, 0, 1)

    # 应用JET色图
    heatmap_uint8 = (heatmap_gray * 255).astype(np.uint8)
    heatmap_color = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)

    # 与原图混合
    alpha = 0.45
    overlay = cv2.addWeighted(img, 1 - alpha, heatmap_color, alpha, 0)

    # 绘制特征标注
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = max(0.5, min(w, h) / 800.0)
    thickness = max(1, int(min(w, h) / 300))

    feature_data = []
    for i, (cx, cy) in enumerate(positions):
        name = disp_features[i] if i < len(disp_features) else f"特征{i + 1}"
        label = FEATURE_LABELS.get(name, f"{name} — AI判别关键区域")

        # 绘制标记点
        cv2.circle(overlay, (cx, cy), 8, (255, 255, 255), -1)
        cv2.circle(overlay, (cx, cy), 14, (255, 255, 255), 2)

        # 绘制半透明标签背景
        text_size = cv2.getTextSize(name, font, font_scale, thickness)[0]
        pad = 6
        tx = max(0, cx - text_size[0] // 2 - pad)
        ty = max(0, cy - 30 - text_size[1] - pad)
        bw = text_size[0] + pad * 2
        bh = text_size[1] + pad * 2
        # 约束在图像内
        if tx + bw > w: tx = w - bw
        if ty + bh > h: ty = h - bh

        # 半透明背景
        roi = overlay[ty:ty + bh, tx:tx + bw]
        dark_bg = np.zeros_like(roi)
        blended = cv2.addWeighted(roi, 0.5, dark_bg, 0.5, 0)
        overlay[ty:ty + bh, tx:tx + bw] = blended

        # 绘制文字
        cv2.putText(overlay, name,
                    (tx + pad, ty + text_size[1] + pad),
                    font, font_scale, (255, 255, 255), thickness)

        feature_data.append({
            "name": name,
            "x": round(cx / w, 4),  # 归一化坐标
            "y": round(cy / h, 4),
            "label": label,
        })

    # 顶部信息条
    header_text = f"AI 特征分析热力图 — {category}" if category else "AI 特征分析热力图"
    header_size = cv2.getTextSize(header_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
    # 顶部半透明条
    header_h = header_size[1] + 16
    header_roi = overlay[:header_h, :]
    dark_header = np.zeros_like(header_roi)
    overlay[:header_h, :] = cv2.addWeighted(header_roi, 0.3, dark_header, 0.7, 0)
    cv2.putText(overlay, header_text,
                (10, header_h - 6),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    # 保存
    HEATMAP_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"heatmap_{uuid.uuid4().hex}.jpg"
    output_path = HEATMAP_DIR / filename
    cv2.imwrite(str(output_path), overlay, [cv2.IMWRITE_JPEG_QUALITY, 92])

    heatmap_url = f"/static/heatmaps/{filename}"
    logger.info(f"热力图生成完成: {heatmap_url}, 特征数: {n_features}")

    return heatmap_url, feature_data


def _add_gaussian_spot(
    canvas: np.ndarray,
    cx: int, cy: int,
    sigma: float,
    intensity: float = 1.0,
):
    """在画布上叠加一个高斯热斑"""
    h, w = canvas.shape

    # 生成高斯核的覆盖范围
    radius = int(sigma * 3)
    x1 = max(0, cx - radius)
    x2 = min(w, cx + radius + 1)
    y1 = max(0, cy - radius)
    y2 = min(h, cy + radius + 1)

    yy, xx = np.ogrid[y1:y2, x1:x2]
    gaussian = np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * sigma ** 2))
    canvas[y1:y2, x1:x2] = np.maximum(canvas[y1:y2, x1:x2], gaussian * intensity)


def _compute_positions(n: int, w: int, h: int) -> list[tuple[int, int]]:
    """根据特征数量计算热点在图像上的分布位置（向后兼容的占位）"""
    # 此函数在新流程中不再使用，保留以防回退
    return _compute_salient_positions(np.ones((h, w, 3), dtype=np.uint8) * 128, n)


def _compute_salient_positions(
    img: np.ndarray,
    n: int,
    min_distance_ratio: float = 0.15,
) -> list[tuple[int, int]]:
    """
    基于图像内容分析的真实显著区域检测。

    使用多种 CV 技术定位图像中最有信息量的区域：
    1. 边缘密度 (Canny) — 纹理细节丰富的区域
    2. 局部对比度 — 视觉突出的区域
    3. 颜色饱和度 — 色彩鲜明的区域

    然后通过非极大值抑制提取前 n 个互不重叠的显著区域中心。
    """
    h, w = img.shape[:2]
    min_dist = int(min(w, h) * min_distance_ratio)

    # === 1. 边缘密度图 ===
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    # 用滑动窗口计算局部边缘密度
    window = max(w, h) // 12
    edge_density = cv2.boxFilter(
        (edges > 0).astype(np.float32), -1, (window, window),
        normalize=True,
    )

    # === 2. 局部对比度 (拉普拉斯方差) ===
    lap = cv2.Laplacian(blurred, cv2.CV_64F)
    lap_abs = np.abs(lap)
    contrast_map = cv2.boxFilter(
        lap_abs.astype(np.float32), -1, (window, window),
        normalize=True,
    )
    # 归一化
    c_min, c_max = contrast_map.min(), contrast_map.max()
    if c_max > c_min:
        contrast_map = (contrast_map - c_min) / (c_max - c_min)

    # === 3. 颜色饱和度 ===
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1].astype(np.float32) / 255.0
    sat_map = cv2.boxFilter(saturation, -1, (window, window), normalize=True)

    # === 4. 合成显著图 ===
    # 加权组合: 边缘 40% + 对比度 35% + 饱和度 25%
    e_min, e_max = edge_density.min(), edge_density.max()
    if e_max > e_min:
        edge_density = (edge_density - e_min) / (e_max - e_min)

    saliency = (
        edge_density * 0.40
        + contrast_map * 0.35
        + sat_map * 0.25
    )

    # === 5. 用非极大值抑制提取峰值 ===
    # 降采样大图以加速
    scale = max(1, min(w, h) // 200)
    small_h, small_w = h // scale, w // scale
    small_sal = cv2.resize(saliency, (small_w, small_h))

    # 使用形态学膨胀实现局部最大值滤波
    kernel_size = max(3, min(small_w, small_h) // 15)
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    local_max = cv2.dilate(small_sal, kernel)
    peaks_mask = (small_sal == local_max) & (small_sal > np.percentile(small_sal, 30))

    # 提取峰值坐标和显著值
    peak_ys, peak_xs = np.where(peaks_mask)
    if len(peak_ys) == 0:
        # 回退：均匀网格
        return _fallback_grid(n, w, h)

    peak_vals = small_sal[peak_ys, peak_xs]
    sorted_idx = np.argsort(peak_vals)[::-1]

    # NMS：依次取最强峰值，排除已选区域附近的点
    selected: list[tuple[int, int]] = []
    small_min_dist = max(1, min_dist // scale)

    for idx in sorted_idx:
        if len(selected) >= n:
            break
        px, py = peak_xs[idx], peak_ys[idx]
        # 检查是否与已选点距离太近
        too_close = False
        for sx, sy in selected:
            dist = np.sqrt((px - sx) ** 2 + (py - sy) ** 2)
            if dist < small_min_dist:
                too_close = True
                break
        if not too_close:
            selected.append((px, py))

    # 如果 NMS 后不够 n 个点，降低距离阈值再试
    if len(selected) < n:
        for idx in sorted_idx:
            if len(selected) >= n:
                break
            px, py = peak_xs[idx], peak_ys[idx]
            if (px, py) not in selected:
                selected.append((px, py))

    # 如果还不够（极少数情况），用网格回退补齐
    while len(selected) < n:
        fallback = _fallback_grid(n, w, h)
        for fb in fallback:
            fb_scaled = (fb[0] // scale, fb[1] // scale)
            if fb_scaled not in selected:
                selected.append(fb_scaled)
                if len(selected) >= n:
                    break

    # 映射回原始分辨率
    return [(int(px * scale + scale / 2), int(py * scale + scale / 2)) for px, py in selected[:n]]


def _fallback_grid(n: int, w: int, h: int) -> list[tuple[int, int]]:
    """回退方案：将显著区域均匀分布（方向感知）"""
    positions = []
    # 黄金比例分割，每次选择与已选点距离最远的点
    candidates = []
    step_x = max(1, w // (n + 1))
    step_y = max(1, h // (n + 1))
    for i in range(1, n + 1):
        for j in range(1, n + 1):
            candidates.append((i * step_x, j * step_y))

    # 第一个点放中心偏上的位置（通常最重要）
    if candidates:
        positions.append(candidates[len(candidates) // 2])
        candidates.remove(positions[0])

    # 贪心选择与已选集合距离最远的点
    while len(positions) < n and candidates:
        best_dist = -1
        best_cand = candidates[0]
        for cand in candidates:
            min_dist = min(
                np.sqrt((cand[0] - p[0]) ** 2 + (cand[1] - p[1]) ** 2)
                for p in positions
            )
            if min_dist > best_dist:
                best_dist = min_dist
                best_cand = cand
        positions.append(best_cand)
        candidates.remove(best_cand)

    return positions
