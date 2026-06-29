"""替换现有非遗项目图片 — 从 360 搜索下载新图片并更新数据库

用法:
    python scripts/replace_images.py --list              # 列出所有项目及图片数量
    python scripts/replace_images.py --all --dry-run     # 试运行: 搜索但不替换
    python scripts/replace_images.py --all               # 替换所有项目图片
    python scripts/replace_images.py --id 1,3,5          # 替换指定 ID
    python scripts/replace_images.py --category 陶瓷     # 替换指定品类
    python scripts/replace_images.py --name 苏绣          # 替换名称包含关键词的项目
    python scripts/replace_images.py --missing-only      # 仅替换没有图片的项目
"""

import argparse
import json
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.models.database import SessionLocal, init_db
from app.models.exhibition import HeritageItem
from app.services.scraper import (
    search_360_images,
    download_image,
    _delay,
    IMAGE_DIR,
)

CURL = "curl"


def list_items(db):
    """列出所有非遗项目及图片数量"""
    items = db.query(HeritageItem).order_by(HeritageItem.category, HeritageItem.name).all()
    print(f"\n{'='*70}")
    print(f"{'ID':<5} {'名称':<25} {'品类':<10} {'图片数':<6}")
    print(f"{'-'*70}")
    for item in items:
        images = json.loads(item.images_json or "[]")
        n = len(images)
        status = "  OK" if n > 0 else "  -- (no img)"
        print(f"{item.id:<5} {item.name[:24]:<25} {item.category:<10} {n:<6}{status}")
    print(f"{'-'*70}")
    print(f"共 {len(items)} 个项目")


def get_target_items(db, args) -> list[HeritageItem]:
    """根据命令行参数筛选目标项目"""
    q = db.query(HeritageItem).order_by(HeritageItem.name)

    if args.id:
        ids = [int(x.strip()) for x in args.id.split(",")]
        return q.filter(HeritageItem.id.in_(ids)).all()
    if args.category:
        return q.filter(HeritageItem.category == args.category).all()
    if args.name:
        return q.filter(HeritageItem.name.contains(args.name)).all()
    if args.missing_only:
        items = q.all()
        return [i for i in items if not json.loads(i.images_json or "[]")]
    if args.all:
        return q.all()

    return []


def replace_item_images(item: HeritageItem, db, dry_run: bool = False) -> bool:
    """为单个非遗项目搜索并下载新图片"""
    name = item.name
    category = item.category
    print(f"\n  [{item.id}] {name} ({category})")

    # 搜索图片 (用项目名 + 品类作为关键词)
    keyword = f"{name} {category} 非遗"
    _delay(1.0, 2.0)
    img_urls = search_360_images(keyword, count=5)

    if not img_urls:
        # 尝试只用项目名
        _delay(0.5, 1.0)
        img_urls = search_360_images(name, count=5)

    if not img_urls:
        print(f"    [SKIP] 未找到图片")
        return False

    if dry_run:
        print(f"    [DRY-RUN] 将替换为 {len(img_urls)} 张新图片:")
        for u in img_urls[:3]:
            print(f"      {u[:100]}...")
        return True

    # 下载图片
    saved = []
    for i, img_url in enumerate(img_urls):
        safe = re.sub(r"[^\w一-鿿]", "_", name)[:30]
        filename = f"replaced_{safe}_{i+1}_{uuid.uuid4().hex[:6]}.jpg"
        save_path = IMAGE_DIR / filename

        print(f"    下载 [{i+1}/{len(img_urls)}] ...", end=" ", flush=True)
        _delay(0.5, 1.0)
        if download_image(img_url, save_path):
            size_kb = save_path.stat().st_size / 1024
            print(f"OK ({size_kb:.0f}KB)")
            saved.append(f"images/{filename}")
        else:
            print("FAIL")

        if len(saved) >= 3:  # 最多 3 张
            break

    if saved:
        item.images_json = json.dumps(saved, ensure_ascii=False)
        print(f"    [OK] 已更新 {len(saved)} 张图片")
        return True
    else:
        print(f"    [FAIL] 所有图片下载失败")
        return False


def main():
    parser = argparse.ArgumentParser(description="替换现有非遗项目的图片")
    parser.add_argument("--list", action="store_true", help="列出所有项目")
    parser.add_argument("--all", action="store_true", help="替换所有项目图片")
    parser.add_argument("--id", type=str, help="替换指定 ID (逗号分隔)")
    parser.add_argument("--category", type=str, help="替换指定品类")
    parser.add_argument("--name", type=str, help="替换名称包含关键词的项目")
    parser.add_argument("--missing-only", action="store_true", help="仅替换没有图片的项目")
    parser.add_argument("--dry-run", action="store_true", help="仅搜索不替换")
    args = parser.parse_args()

    init_db()
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()

    try:
        if args.list:
            list_items(db)
            return

        targets = get_target_items(db, args)
        if not targets:
            print("未找到目标项目。使用 --list 查看所有项目，或指定 --all / --id / --category / --name / --missing-only")
            return

        mode = "试运行 (不替换)" if args.dry_run else "正式替换"
        print(f"{'='*60}")
        print(f"图片替换工具")
        print(f"模式: {mode}")
        print(f"目标: {len(targets)} 个项目")
        print(f"{'='*60}")

        success = 0
        for item in targets:
            if replace_item_images(item, db, dry_run=args.dry_run):
                success += 1

        if not args.dry_run and success > 0:
            db.commit()
            print(f"\n数据库已更新 ({success} 项)")

        print(f"\n{'='*60}")
        print(f"完成: {success}/{len(targets)} 成功")

        if args.dry_run and success > 0:
            print(f"\n使用以下命令正式替换: python scripts/replace_images.py --all")

    finally:
        db.close()


if __name__ == "__main__":
    main()
