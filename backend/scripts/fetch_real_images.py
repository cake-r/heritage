"""从多个数据源获取非遗项目真实图片

数据源优先级: Bing图片搜索 > 百度百科 > 中国非遗网

用法:
    python scripts/fetch_real_images.py              # 下载所有图片
    python scripts/fetch_real_images.py --dry-run     # 仅测试
    python scripts/fetch_real_images.py --limit 10    # 仅处理前10个
    python scripts/fetch_real_images.py --force       # 强制覆盖已有图片
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HERITAGE_FILE = Path(__file__).resolve().parent.parent / "data" / "knowledge" / "heritage_sample.json"
KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "data" / "uploads" / "knowledge"

MIN_IMAGE_SIZE = 8000  # 最小图片大小 (bytes)
CURL = "curl"

# 通用浏览器 UA
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


def fetch_url(url: str, headers: dict | None = None, timeout: int = 15) -> bytes | None:
    """使用 curl 获取 URL 的原始字节内容"""
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


def decode_text(raw: bytes) -> str | None:
    """尝试多种编码解码文本"""
    for enc in ["utf-8", "gb18030", "gbk"]:
        try:
            text = raw.decode(enc)
            if len(text) > 100:
                return text
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="ignore")


def search_bing_images(item_name: str) -> str | None:
    """从 Bing 图片搜索获取第一张图片URL"""
    query = urllib.parse.quote(f"{item_name} 非遗 中国传统文化")
    url = f"https://cn.bing.com/images/search?q={query}&first=1"

    print(f"    Bing图片 ...", end=" ", flush=True)

    raw = fetch_url(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })

    if not raw:
        print("无响应")
        return None

    html = decode_text(raw)
    if not html:
        print("解码失败")
        return None

    # Bing 图片搜索结果中提取 murl (media URL)
    matches = re.findall(r'murl&quot;:&quot;(https?://[^&]+?\.(?:jpg|jpeg|png|webp))', html)
    if not matches:
        # 尝试更宽松的匹配
        matches = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', html)
        # 过滤出图片URL
        matches = [m for m in matches if any(m.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp'])]

    if matches:
        # 取第一个有效URL (通常是质量最好的)
        for img_url in matches[:5]:
            # 跳过明显太小的缩略图
            if "80x80" in img_url or "thumb" in img_url.lower():
                continue
            print(f"OK")
            return img_url

    print("无结果")
    return None


def fetch_baike_image_url(item_name: str) -> str | None:
    """从百度百科页面提取主图URL"""
    encoded = urllib.parse.quote(item_name)
    url = f"https://baike.baidu.com/item/{encoded}"

    print(f"    百度百科 ...", end=" ", flush=True)

    raw = fetch_url(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })

    if not raw:
        print("无响应")
        return None

    html = decode_text(raw)
    if not html:
        print("解码失败")
        return None

    # 百度安全验证 — 被拦截了
    if "百度安全验证" in html:
        print("被拦截")
        return None

    # 策略 1: meta name="image"
    match = re.search(r'<meta[^>]*name="image"[^>]*content="([^"]+)"', html)
    if match:
        base_url = re.sub(r"\?x-bce-process.*", "", match.group(1))
        print(f"OK")
        return base_url

    # 策略 2: summary-pic
    match = re.search(r'class="summary-pic"[^>]*>.*?<img[^>]+src="([^"]+)"', html, re.DOTALL)
    if match:
        print(f"OK")
        return match.group(1)

    # 策略 3: 任意 bkimg CDN URL
    match = re.search(r'(https?://bkimg\.cdn\.bcebos\.com/[^"\'?\s]+)', html)
    if match:
        base_url = re.sub(r"\?x-bce-process.*", "", match.group(1))
        print(f"OK(CDN)")
        return base_url

    print("未找到")
    return None


def download_image(img_url: str, save_path: Path) -> bool:
    """下载图片到本地，返回是否成功"""
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # 确定合适的 Referer
    referer = "https://cn.bing.com/"
    if "baidu" in img_url or "bcebos" in img_url:
        referer = "https://baike.baidu.com/"

    raw = fetch_url(img_url, headers={
        "Referer": referer,
        "User-Agent": UA,
    }, timeout=25)

    if not raw or len(raw) < MIN_IMAGE_SIZE:
        return False

    # 验证图片头部
    header = raw[:12]
    if not any(header.startswith(h) for h in [b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"GIF8", b"RIFF"]):
        return False

    save_path.write_bytes(raw)
    return True


def try_get_image_url(item_name: str) -> str | None:
    """依次尝试多个数据源获取图片URL"""

    # 1. Bing 图片搜索 (最可靠)
    img_url = search_bing_images(item_name)
    if img_url:
        return img_url

    # 2. 百度百科
    time.sleep(1.0)
    img_url = fetch_baike_image_url(item_name)
    if img_url:
        return img_url

    # 3. 百度百科简化名
    if len(item_name) > 4:
        time.sleep(1.0)
        short = item_name[:4]
        print(f"    重试 [{short}] ...", end=" ", flush=True)
        img_url = fetch_baike_image_url(short)
        if img_url:
            return img_url

    return None


def reseed_database():
    """重新导入数据到 SQLite"""
    script = Path(__file__).parent / "seed_knowledge.py"
    if script.exists():
        print("  重新导入数据库...")
        subprocess.run([sys.executable, str(script)],
                       cwd=str(Path(__file__).parent.parent),
                       capture_output=True)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="从Bing/百度百科下载非遗真实图片")
    parser.add_argument("--dry-run", action="store_true", help="仅测试不下载")
    parser.add_argument("--limit", type=int, default=0, help="仅处理前N项")
    parser.add_argument("--force", action="store_true", help="强制覆盖已有图片")
    args = parser.parse_args()

    with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    print("=" * 60)
    print("非遗真实图片下载工具 v2")
    print(f"数据源: Bing图片搜索 > 百度百科")
    print(f"模式: {'试运行' if args.dry_run else '下载模式'}")
    print(f"项目数: {len(items)}")
    print("=" * 60)

    KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)

    # 检查已存在的图片
    existing_real = set()
    if not args.force and KNOWLEDGE_DIR.exists():
        for f in KNOWLEDGE_DIR.iterdir():
            if f.is_file() and f.stat().st_size > MIN_IMAGE_SIZE:
                existing_real.add(f.name)

    success = 0
    skipped = 0
    failed = 0

    to_process = items[:args.limit] if args.limit > 0 else items

    for i, item in enumerate(to_process):
        name = item.get("name", "")
        category = item.get("category", "其他")

        print(f"\n[{i+1}/{len(to_process)}] {name} ({category})")

        # 生成文件名
        safe_name = re.sub(r"[^\w一-鿿]", "_", name)[:50]
        filename = f"{safe_name}_1.jpg"

        # 跳过已有真实图片
        if filename in existing_real:
            item["images"] = [f"knowledge/{filename}"]
            print(f"    已有真实图片 -> 跳过")
            skipped += 1
            continue

        # 搜索图片URL
        img_url = try_get_image_url(name)

        if not img_url:
            print(f"    [X] 未找到图片")
            failed += 1
            continue

        # 下载
        if args.dry_run:
            print(f"    -> {img_url[:110]}...")
            success += 1
        else:
            save_path = KNOWLEDGE_DIR / filename
            print(f"    下载 {img_url[:80]}...", end=" ", flush=True)
            if download_image(img_url, save_path):
                size_kb = save_path.stat().st_size / 1024
                print(f"OK ({size_kb:.0f}KB)")
                item["images"] = [f"knowledge/{filename}"]
                success += 1
            else:
                print(f"FAIL")
                failed += 1

        # 礼貌延迟
        time.sleep(1.5)

    # 保存 JSON
    if not args.dry_run and success > 0:
        with open(HERITAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"\n已更新: {HERITAGE_FILE}")

    print(f"\n{'=' * 60}")
    print(f"完成: {success}成功, {skipped}跳过, {failed}失败")
    print(f"图片目录: {KNOWLEDGE_DIR}")

    if not args.dry_run and success > 0:
        reseed_database()


if __name__ == "__main__":
    main()
