"""修复/补充下载失败或图片质量差的非遗项目图片

用法:
    python scripts/fix_failed_images.py
"""

import json
import re
import subprocess
import sys
import time
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HERITAGE_FILE = Path(__file__).resolve().parent.parent / "data" / "knowledge" / "heritage_sample.json"
KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "data" / "uploads" / "knowledge"

MIN_IMAGE_SIZE = 8000
CURL = "curl"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


# 需要修复的项目: 针对性的搜索词 (用更具体的关键词)
FIX_TERMS = {
    "景德镇手工制瓷": ["Jingdezhen porcelain making ceramic China heritage", "景德镇瓷器 非遗 手工艺"],
    "皮影戏": ["Chinese shadow puppet piying show traditional", "皮影戏 非遗 传统戏曲 皮影"],
    "宜兴紫砂陶": ["Yixing zisha purple clay teapot master", "宜兴紫砂壶 非遗 手工制作"],
    "粤绣": ["Guangdong Yue embroidery traditional Chinese", "粤绣 广绣 非遗 传统刺绣"],
    "杭绣": ["Hangzhou embroidery silk Chinese traditional", "杭绣 杭州刺绣 非遗"],
    "德化白瓷": ["Dehua white porcelain Blanc de Chine figure", "德化白瓷 德化瓷 非遗 观音"],
    "华县皮影": ["Huaxian shadow puppet Shaanxi piying", "华县皮影 陕西 非遗 皮影雕刻"],
    "自贡龚扇": ["Zigong Gong fan bamboo weaving traditional", "自贡龚扇 竹编扇 非遗"],
    "中国书法": ["Chinese calligraphy brush art traditional shufa", "中国书法 毛笔 书法艺术 非遗"],
    "内画鼻烟壶": ["Chinese inside painted snuff bottle neihua art", "内画鼻烟壶 非遗 工艺"],
    "宜兴紫砂陶制作": ["Yixing zisha teapot making process craft", "宜兴紫砂 制壶 非遗"],
    "青田石雕": ["Qingtian stone carving traditional Chinese art", "青田石雕 非遗 雕刻"],
    "曲阳石雕": ["Quyang stone carving Hebei traditional sculpture", "曲阳石雕 河北 非遗 石雕"],
    "寿山石雕": ["Shoushan stone carving Tianhuang seal China", "寿山石雕 田黄 非遗"],
    "龙泉宝剑锻制": ["Longquan sword traditional Chinese forging weapon", "龙泉宝剑 锻制 非遗"],
    "蔚县剪纸": ["Yuxian paper cutting Hebei folk art traditional", "蔚县剪纸 河北 非遗 剪纸艺术"],
    "桃花坞木版年画": ["Taohuawu woodblock New Year print Suzhou", "桃花坞年画 苏州 非遗"],
}


def fetch_url(url: str, headers: dict | None = None, timeout: int = 15) -> bytes | None:
    cmd = ["curl", "-s", "-L", "--compressed", "--max-time", str(timeout)]
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


def decode_text(raw: bytes) -> str:
    for enc in ["utf-8", "gb18030", "gbk"]:
        try:
            text = raw.decode(enc)
            if len(text) > 100:
                return text
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="ignore")


def get_bing_image_urls(query: str, count: int = 10) -> list[str]:
    """从Bing图片搜索获取多个图片URL"""
    encoded = urllib.parse.quote(query)
    url = f"https://cn.bing.com/images/search?q={encoded}&first=1&count={count}"

    raw = fetch_url(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
    })

    if not raw:
        return []

    html = decode_text(raw)

    # 提取所有图片URL
    urls = re.findall(r'murl&quot;:&quot;(https?://[^&]+?)&quot;', html)
    # 过滤出图片格式
    img_urls = []
    seen = set()
    for u in urls:
        u = u.replace("\\u002f", "/")
        if any(u.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp']):
            if u not in seen:
                seen.add(u)
                img_urls.append(u)
    return img_urls


def download_image(img_url: str, save_path: Path) -> bool:
    save_path.parent.mkdir(parents=True, exist_ok=True)

    referer = "https://cn.bing.com/"
    if "baidu" in img_url or "bcebos" in img_url:
        referer = "https://baike.baidu.com/"

    raw = fetch_url(img_url, headers={
        "Referer": referer,
        "User-Agent": UA,
    }, timeout=25)

    if not raw or len(raw) < MIN_IMAGE_SIZE:
        return False

    header = raw[:12]
    if not any(header.startswith(h) for h in [b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n", b"GIF8", b"RIFF"]):
        return False

    save_path.write_bytes(raw)
    return True


def main():
    with open(HERITAGE_FILE, "r", encoding="utf-8") as f:
        items = json.load(f)

    print("=" * 60)
    print("修复失败/低质量非遗图片")
    print("=" * 60)

    # 构建名称到项目的映射
    item_map = {item["name"]: item for item in items}

    # 检查哪些需要修复
    to_fix = []
    for name, terms in FIX_TERMS.items():
        if name not in item_map:
            continue
        item = item_map[name]
        images = item.get("images", [])
        if not images:
            to_fix.append((name, terms))
            continue
        # 检查图片是否存在且质量OK
        fname = Path(images[0]).name if images else ""
        fpath = KNOWLEDGE_DIR / fname
        if not fpath.exists() or fpath.stat().st_size < 10000:
            to_fix.append((name, terms))

    print(f"需要修复: {len(to_fix)} 项")
    print()

    fixed = 0
    for name, queries in to_fix:
        print(f"\n--- {name} ---")
        safe_name = re.sub(r"[^\w一-鿿]", "_", name)[:50]
        save_path = KNOWLEDGE_DIR / f"{safe_name}_1.jpg"

        downloaded = False
        for query in queries:
            if downloaded:
                break

            print(f"  搜索: {query[:60]}...")
            img_urls = get_bing_image_urls(query)

            if not img_urls:
                print(f"    无结果")
                continue

            # 尝试下载前5个
            for j, img_url in enumerate(img_urls[:5]):
                print(f"    [{j+1}] {img_url[:90]}...", end=" ", flush=True)
                if download_image(img_url, save_path):
                    size_kb = save_path.stat().st_size / 1024
                    print(f"OK ({size_kb:.0f}KB)")
                    item_map[name]["images"] = [f"knowledge/{safe_name}_1.jpg"]
                    downloaded = True
                    fixed += 1
                    break
                else:
                    print("FAIL")

            time.sleep(1.0)

        if not downloaded:
            print(f"  [X] 所有来源均失败")

    # 保存
    if fixed > 0:
        with open(HERITAGE_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        print(f"\n已更新 {HERITAGE_FILE}")
        print(f"修复: {fixed} 项")

    print(f"\n最终统计:")
    existing = sum(1 for item in items if item.get("images") and len(item["images"]) > 0)
    print(f"  有图片: {existing}/{len(items)}")

    # 重新导入数据库
    if fixed > 0:
        print("重新导入数据库...")
        subprocess.run([sys.executable, str(Path(__file__).parent / "seed_knowledge.py")],
                       cwd=str(Path(__file__).parent.parent), capture_output=True)


if __name__ == "__main__":
    main()
