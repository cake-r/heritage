"""非遗知识库种子数据导入脚本

用法:
  cd backend
  python scripts/seed_knowledge.py

  读取 data/knowledge/heritage_sample.json → 写入数据库
  如果已有数据则跳过 (避免重复导入)
"""

import json
import sys
import os

# 添加 backend 到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import SessionLocal, init_db
from app.models.exhibition import HeritageItem


def seed(json_path: str = None):
    if json_path is None:
        json_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "data", "knowledge", "heritage_sample.json"
        )

    if not os.path.exists(json_path):
        print(f"错误: 数据文件不存在: {json_path}")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    init_db()
    db = SessionLocal()

    existing_count = db.query(HeritageItem).count()
    if existing_count > 0:
        print(f"数据库已有 {existing_count} 条记录，跳过导入")
        db.close()
        return

    for item in items:
        h = HeritageItem(
            name=item["name"],
            category=item["category"],
            region=item.get("region"),
            era=item.get("era"),
            description=item.get("description"),
            techniques_json=json.dumps(item.get("techniques", []), ensure_ascii=False),
            inheritors_json=json.dumps(item.get("inheritors", []), ensure_ascii=False),
            images_json=json.dumps(item.get("images", []), ensure_ascii=False),
            cultural_meaning=item.get("cultural_meaning"),
        )
        db.add(h)

    db.commit()
    print(f"导入完成: {len(items)} 条非遗数据")
    db.close()


if __name__ == "__main__":
    seed()
