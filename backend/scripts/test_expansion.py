"""测试知识库扩充流程 — 爬取 3 个非遗项目直接入库

用法:
    python scripts/test_expansion.py              # 爬取3个
    python scripts/test_expansion.py --count 5    # 爬取5个
    python scripts/test_expansion.py --dry-run    # 只搜索不入库
"""

import json
import os
import re
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.services.scraper import (
    search_360_items,
    search_360_images,
    download_image,
    get_existing_names,
    _delay,
    IMAGE_DIR,
)
from app.services.ai.llm import chat
from app.models.database import SessionLocal, init_db
from app.models.exhibition import HeritageItem

# 19 个非遗品类
CATEGORIES = [
    "刺绣", "陶瓷", "剪纸", "皮影", "木雕",
    "漆器", "织锦", "金属工艺", "年画", "泥塑",
    "玉雕", "竹编", "戏曲", "中医药", "茶文化",
    "书法", "古琴", "武术", "其他",
]


def structure_with_llm(raw_info: dict) -> dict | None:
    """使用 DeepSeek 将搜索到的原始信息结构化为 HeritageItem 格式"""
    prompt = f"""你是中国非物质文化遗产研究专家。请根据以下搜索结果，为这项非遗项目补全结构化信息。

搜索关键词: {raw_info.get('keyword', '')}
搜索摘要: {raw_info.get('snippet', '')}
候选名称: {raw_info.get('name', '')}

请严格按 JSON 格式返回（不要加```json标记，直接返回纯JSON）:
{{
  "name": "非遗项目准确全称",
  "category": "所属品类(必须从以下19个中选择最匹配的一个: {', '.join(CATEGORIES)})",
  "region": "发源地/主要流传地区(省市格式, 如'江苏苏州')",
  "era": "起源朝代或时期(如'宋代'、'明代'、'春秋战国')",
  "description": "150-250字的简介，包含历史背景和艺术特色",
  "techniques": [{{"name": "技法名1", "desc": "简要说明(20字以内)"}}, ...],
  "inheritors": [{{"name": "传承人名", "title": "称号(如'国家级非遗传承人')", "desc": "简要贡献(30字以内)"}}, ...],
  "cultural_meaning": "80-150字的文化寓意说明"
}}

要求:
1. 所有信息必须真实准确，不要编造
2. 如果搜索结果信息不足，基于你的知识库补充
3. techniques 至少2个，inheritors 至少1个
4. 确保 category 严格匹配上述19个品类之一"""

    messages = [{"role": "user", "content": prompt}]
    try:
        text = chat(messages)
        text = text.strip()
        # 清理可能的 markdown 代码块标记
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else text
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"    LLM 返回格式错误: {e}")
        print(f"    原始返回: {text[:200]}...")
        return None
    except Exception as e:
        print(f"    LLM 调用失败: {e}")
        return None


def expand_one(category: str, existing_names: set[str]) -> dict | None:
    """为一个品类搜索并结构化一个非遗项目"""
    keyword = f"{category} 非物质文化遗产 中国传统技艺"

    # 1. 360 搜索
    _delay(1.0, 2.0)
    search_results = search_360_items(keyword, count=5)

    if not search_results:
        print(f"  [FAIL] 无搜索结果")
        return None

    # 2. 逐个尝试搜索结果，直到找到不在数据库中的项目
    for result in search_results:
        name = result.get("title", "").strip()
        # 清理名称（去掉"非遗"、"文化遗产"等后缀和HTML标签）
        name = re.sub(r"<[^>]+>", "", name)
        name = re.sub(r"[（(].*?[）)]", "", name)  # 去掉括号内容
        name = name.strip()

        if len(name) < 2 or len(name) > 50:
            continue

        # 去重检查
        if name.lower() in existing_names:
            print(f"    跳过重复: {name}")
            continue

        print(f"    候选: {name}")

        # 3. 用 LLM 结构化
        raw_info = {
            "keyword": keyword,
            "name": result.get("title", ""),
            "snippet": result.get("snippet", ""),
        }
        structured = structure_with_llm(raw_info)

        if not structured:
            continue

        # 确保 name 字段存在
        if not structured.get("name"):
            structured["name"] = name

        # 确保 category 在 19 个品类内
        cat = structured.get("category", category)
        if cat not in CATEGORIES:
            # 尝试模糊匹配
            for c in CATEGORIES:
                if c in cat or cat in c:
                    cat = c
                    break
            else:
                cat = category
        structured["category"] = cat

        # 4. 搜索图片
        img_keyword = structured.get("name", name)
        _delay(1.0, 2.0)
        img_urls = search_360_images(img_keyword, count=3)

        # 5. 下载图片
        saved_images = []
        for i, img_url in enumerate(img_urls):
            safe_name = re.sub(r"[^\w一-鿿]", "_", img_keyword)[:30]
            filename = f"expansion_{safe_name}_{i+1}_{uuid.uuid4().hex[:6]}.jpg"
            save_path = IMAGE_DIR / filename

            print(f"    下载图片 [{i+1}/{len(img_urls)}] ...", end=" ", flush=True)
            _delay(0.5, 1.0)
            if download_image(img_url, save_path):
                size_kb = save_path.stat().st_size / 1024
                print(f"OK ({size_kb:.0f}KB)")
                saved_images.append(f"images/{filename}")
            else:
                print("FAIL")

        structured["images"] = saved_images
        structured["search_keyword"] = keyword
        structured["source_urls"] = [result.get("url", "")] if result.get("url") else []

        existing_names.add(name.lower())
        return structured

    print(f"  [FAIL] 所有候选都是重复的")
    return None


def insert_into_db(item: dict):
    """将结构化数据插入 heritage_items 表"""
    db = SessionLocal()
    try:
        heritage = HeritageItem(
            name=item["name"],
            category=item["category"],
            region=item.get("region", ""),
            era=item.get("era", ""),
            description=item.get("description", ""),
            techniques_json=json.dumps(item.get("techniques", []), ensure_ascii=False),
            inheritors_json=json.dumps(item.get("inheritors", []), ensure_ascii=False),
            images_json=json.dumps(item.get("images", []), ensure_ascii=False),
            cultural_meaning=item.get("cultural_meaning", ""),
        )
        db.add(heritage)
        db.commit()
        print(f"  [OK] 已入库: {item['name']} ({item['category']})")
        return True
    except Exception as e:
        db.rollback()
        print(f"  [FAIL] 入库失败: {e}")
        return False
    finally:
        db.close()


def main():
    import argparse
    parser = argparse.ArgumentParser(description="测试非遗知识库扩充流程")
    parser.add_argument("--count", type=int, default=3, help="扩充数量 (默认3)")
    parser.add_argument("--dry-run", action="store_true", help="仅搜索不入库")
    args = parser.parse_args()

    print("=" * 60)
    print("非遗知识库扩充测试")
    print(f"模式: {'试运行(不入库)' if args.dry_run else '正式模式'}")
    print(f"目标: {args.count} 个项目")
    print(f"数据源: 360搜索 + DeepSeek结构化 + 360图片")
    print("=" * 60)

    # 初始化数据库
    init_db()

    # 确保图片目录存在
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)

    # 获取已有项目名称（去重）
    existing_names = get_existing_names()
    print(f"\n已有非遗项目: {len(existing_names)} 个")
    print(f"已有名称示例: {list(existing_names)[:5]}")

    # 轮询品类，抽取不同品类
    import random
    random.shuffle(CATEGORIES)

    success = 0
    attempted = 0
    results = []

    for category in CATEGORIES:
        if success >= args.count:
            break

        attempted += 1
        print(f"\n[{success+1}/{args.count}] 品类: {category} (尝试 #{attempted})")

        item = expand_one(category, existing_names)

        if item:
            results.append(item)
            if not args.dry_run:
                if insert_into_db(item):
                    success += 1
            else:
                print(f"  [DRY-RUN] 将入库: {item['name']}")
                success += 1

    # 汇总
    print(f"\n{'=' * 60}")
    print(f"完成: {success}/{args.count} 成功")
    print(f"共尝试 {attempted} 个品类")

    if results:
        print(f"\n新入库项目:")
        for item in results:
            print(f"  - {item['name']} ({item['category']})")
            print(f"    地区: {item.get('region', '?')}, 时代: {item.get('era', '?')}")
            print(f"    技法: {len(item.get('techniques', []))}个, 传承人: {len(item.get('inheritors', []))}个")
            print(f"    图片: {len(item.get('images', []))}张")

    # 保存结果到 JSON (方便查看)
    output_file = Path(__file__).parent.parent / "data" / "expansion_test_results.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存: {output_file}")


if __name__ == "__main__":
    main()
