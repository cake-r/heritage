"""360搜索爬虫 — 非遗知识库扩充

数据源: so.360.cn (网页搜索) + image.so.com (图片搜索)
策略: 360搜索发现非遗项目名称 → DeepSeek结构化 → 360图片搜索下载图片

用法:
    from app.services.scraper import search_360_items, search_360_images, download_image
"""

import json
import logging
import random
import re
import subprocess
import time
import urllib.parse
from pathlib import Path
from typing import Optional

logger = logging.getLogger("scraper")

CURL = "curl"
BASE_DIR = Path(__file__).resolve().parent.parent.parent
HEADERS_FILE = BASE_DIR / "config" / "headers.json"
IMAGE_DIR = BASE_DIR / "data" / "uploads" / "images"

MIN_IMAGE_SIZE = 5000  # 最小图片大小 (bytes)，比 fetch_real_images 宽松一些


def _load_headers(referer: str = "https://www.so.com/") -> dict:
    """加载 headers 配置，随机选择一个 User-Agent"""
    headers = {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Referer": referer,
    }

    if HEADERS_FILE.exists():
        try:
            with open(HEADERS_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
            ua_list = config.get("user_agents", [])
            if ua_list:
                headers["User-Agent"] = random.choice(ua_list)
            # 合并通用 headers
            common = config.get("common_headers", {})
            for k, v in common.items():
                if k not in headers:
                    headers[k] = v
            return headers
        except Exception:
            pass

    # 兜底 UA
    headers["User-Agent"] = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
    )
    return headers


def _delay(min_s: float = 1.5, max_s: float = 2.5):
    """随机延迟，防止被拦截"""
    time.sleep(random.uniform(min_s, max_s))


def _fetch_url(url: str, headers: dict | None = None, timeout: int = 15) -> bytes | None:
    """使用 curl 获取 URL 的原始字节内容 (复用 fetch_real_images.py 模式)"""
    cmd = [CURL, "-s", "-L", "--compressed", "--max-time", str(timeout)]

    if headers:
        for k, v in headers.items():
            cmd.extend(["-H", f"{k}: {v}"])

    cmd.append(url)

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=timeout + 5)
        if result.returncode == 0 and result.stdout and len(result.stdout) > 200:
            return result.stdout
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def _decode_text(raw: bytes) -> str | None:
    """尝试多种编码解码文本 (复用 fetch_real_images.py 模式)"""
    for enc in ["utf-8", "gb18030", "gbk"]:
        try:
            text = raw.decode(enc)
            if len(text) > 100:
                return text
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="ignore")


def search_360_items(keyword: str, count: int = 5) -> list[dict]:
    """
    在 360 搜索 (so.360.cn) 中搜索非遗项目。

    返回搜索结果列表，每项包含:
        {title, snippet, url}

    Args:
        keyword: 搜索关键词
        count: 需要的搜索结果数量
    """
    results = []
    query = urllib.parse.quote(f"{keyword} 非物质文化遗产")
    url = f"https://www.so.com/s?q={query}&pn=1"

    logger.info(f"  360搜索: {keyword}")

    headers = _load_headers(referer="https://www.so.com/")
    raw = _fetch_url(url, headers=headers, timeout=15)

    if not raw:
        logger.warning(f"  360搜索无响应: {keyword}")
        return results

    html = _decode_text(raw)
    if not html:
        logger.warning(f"  360搜索解码失败: {keyword}")
        return results

    # 360搜索被拦截检测
    if "请输入验证码" in html or "安全验证" in html or "访问过于频繁" in html:
        logger.warning(f"  360搜索触发验证: {keyword}")
        return results

    # 解析搜索结果
    # 360 搜索结果通常在 <div class="result"> 或 <li class="res-list"> 中
    # 标题在 <h3 class="res-title"> 或 <a> 标签中
    # 摘要用正则从搜索结果中提取

    # 策略 1: 匹配 res-list 中的标题和摘要
    pattern = re.compile(
        r'<h3[^>]*class="[^"]*res-title[^"]*"[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>.*?</h3>'
        r'.*?<p[^>]*class="[^"]*res-desc[^"]*"[^>]*>(.*?)</p>',
        re.DOTALL,
    )
    matches = pattern.findall(html)

    if not matches:
        # 策略 2: 更宽松的匹配 — 找所有带 href 的标题链接
        pattern2 = re.compile(
            r'<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>',
            re.DOTALL,
        )
        all_links = pattern2.findall(html)
        # 过滤掉导航链接和广告
        for link_url, title in all_links:
            title_clean = re.sub(r"<[^>]+>", "", title).strip()
            if len(title_clean) >= 4 and len(title_clean) <= 100:
                if any(kw in title_clean for kw in ["非遗", "文化", "传统", "工艺", "遗产"]):
                    results.append({
                        "title": title_clean,
                        "snippet": "",
                        "url": link_url,
                    })
    else:
        for link_url, title_raw, snippet in matches:
            title_clean = re.sub(r"<[^>]+>", "", title_raw).strip()
            snippet_clean = re.sub(r"<[^>]+>", "", snippet).strip()
            if len(title_clean) >= 2:
                results.append({
                    "title": title_clean,
                    "snippet": snippet_clean,
                    "url": link_url,
                })

    logger.info(f"  360搜索找到 {len(results)} 个结果")
    return results[:count]


def search_360_images(keyword: str, count: int = 3) -> list[str]:
    """
    在 360 图片搜索 (image.so.com) 中搜索图片。

    Returns:
        list[str]: 图片URL列表
    """
    images = []
    query = urllib.parse.quote(f"{keyword} 非遗")
    # 360 图片搜索 JSON API
    url = f"https://image.so.com/j?q={query}&src=srp&pn=1&rn={min(count * 3, 30)}"

    logger.info(f"  360图片: {keyword}")

    headers = _load_headers(referer="https://image.so.com/")
    headers["Accept"] = "application/json, text/plain, */*"

    raw = _fetch_url(url, headers=headers, timeout=15)

    if not raw:
        logger.warning(f"  360图片无响应: {keyword}")
        return images

    text = _decode_text(raw)
    if not text:
        return images

    try:
        data = json.loads(text)
        img_list = data.get("list", [])
        for img in img_list:
            img_url = img.get("img") or img.get("thumb") or img.get("middle")
            if not img_url:
                continue
            # 跳过太小的缩略图
            if "thumb" in img_url.lower() and "80x80" in img_url:
                continue
            if img_url.startswith("http") and img_url not in images:
                images.append(img_url)
    except (json.JSONDecodeError, KeyError):
        # 回退: 从HTML中提取图片URL
        pattern = re.compile(r'"img":"(https?://[^"]+\.(?:jpg|jpeg|png|webp))"')
        matches = pattern.findall(text or "")
        images = [m for m in matches if "thumb" not in m.lower() or "80x80" not in m]

    logger.info(f"  360图片找到 {len(images)} 个")
    return images[:count]


def download_image(img_url: str, save_path: Path) -> bool:
    """
    下载图片到本地，验证文件头。

    Returns:
        bool: 是否成功
    """
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # 根据URL确定 Referer
    if "so.com" in img_url or "360" in img_url:
        referer = "https://image.so.com/"
    elif "baidu" in img_url or "bcebos" in img_url:
        referer = "https://image.baidu.com/"
    else:
        referer = "https://www.so.com/"

    headers = _load_headers(referer=referer)
    headers["Accept"] = "image/webp,image/apng,image/*,*/*;q=0.8"

    raw = _fetch_url(img_url, headers=headers, timeout=20)

    if not raw or len(raw) < MIN_IMAGE_SIZE:
        return False

    # 验证图片头部
    header = raw[:12]
    valid_headers = [
        b"\xff\xd8\xff",         # JPEG
        b"\x89PNG\r\n\x1a\n",    # PNG
        b"GIF8",                  # GIF
        b"RIFF",                  # WebP
        b"<?xml",                 # SVG
        b"<svg",                  # SVG
    ]
    if not any(header.startswith(h) for h in valid_headers):
        return False

    save_path.write_bytes(raw)
    return True


def get_existing_names() -> set[str]:
    """获取数据库中已有的非遗项目名称（用于去重）"""
    from app.models.database import SessionLocal
    from app.models.exhibition import HeritageItem

    db = SessionLocal()
    try:
        items = db.query(HeritageItem.name).all()
        return {name.lower().strip() for (name,) in items}
    except Exception:
        return set()
    finally:
        db.close()
