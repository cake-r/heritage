#!/usr/bin/env python3
"""
批量生成嵌入向量 — 为所有 heritage_items 和 heritage_chunks 生成嵌入

用法:
    python scripts/backfill_embeddings.py
    python scripts/backfill_embeddings.py --chunks-only   # 仅处理分块
    python scripts/backfill_embeddings.py --items-only    # 仅处理条目

首次部署或数据迁移后运行。已有嵌入的会被跳过 (增量式)。
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from app.models.database import SessionLocal
from app.models.exhibition import HeritageItem
from app.services.ai.embedding import (
    ensure_item_embedding,
    chunk_heritage_item,
    call_embedding_api,
)
from app.services.ai.base import mock_mode


def backfill_items():
    """为所有 heritage_items 生成/补充嵌入"""
    db = SessionLocal()
    try:
        items = db.query(HeritageItem).all()
        total = len(items)
        print(f"条目级嵌入: 共 {total} 条")

        for i, item in enumerate(items):
            existing = getattr(item, "embedding_json", None)
            if existing and existing != "null":
                print(f"  [{i + 1}/{total}] {item.name} — 已有嵌入，跳过")
                continue

            vec = ensure_item_embedding(item, db)
            status = "✓" if vec else "✗ 失败"
            print(f"  [{i + 1}/{total}] {item.name} — {status}")

        print("条目级嵌入完成")
    finally:
        db.close()


def backfill_chunks():
    """为所有 heritage_items 生成分块 + 嵌入"""
    db = SessionLocal()
    try:
        items = db.query(HeritageItem).all()
        total = len(items)
        total_chunks = 0
        print(f"分块级嵌入: 共 {total} 条条目")

        for i, item in enumerate(items):
            # 检查是否已有分块
            from app.models.heritage_chunk import HeritageChunk
            existing = db.query(HeritageChunk).filter(
                HeritageChunk.heritage_item_id == item.id
            ).count()
            if existing > 0:
                print(f"  [{i + 1}/{total}] {item.name} — 已有 {existing} 个分块，跳过")
                total_chunks += existing
                continue

            n = chunk_heritage_item(item, db)
            print(f"  [{i + 1}/{total}] {item.name} — 创建 {n} 个分块")
            total_chunks += n

        print(f"分块完成: 共 {total_chunks} 个分块")
    finally:
        db.close()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="批量生成嵌入向量")
    parser.add_argument("--chunks-only", action="store_true", help="仅处理分块")
    parser.add_argument("--items-only", action="store_true", help="仅处理条目")
    args = parser.parse_args()

    if mock_mode():
        print("Mock 模式: 嵌入服务使用伪随机向量 (测试用)")

    if not args.chunks_only:
        backfill_items()

    if not args.items_only:
        backfill_chunks()

    print("全部完成")


if __name__ == "__main__":
    main()
