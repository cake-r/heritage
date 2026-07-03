"""模块⑤ 非遗文化图谱 API — 统一非遗探索"""

import json
import logging
import os
from collections import Counter, defaultdict
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.models.database import get_db
from app.models.exhibition import HeritageItem
from app.utils.geo_coords import get_province_coords, extract_province

logger = logging.getLogger("knowledge_graph_api")
router = APIRouter()

# 朝代顺序 & 年份区间
ERA_ORDER = ["春秋", "战国", "汉", "南北朝", "唐", "宋", "元", "明", "清", "近现代"]
ERA_START = {
    "春秋": -770, "战国": -475, "汉": -202, "南北朝": 420,
    "唐": 618, "宋": 960, "元": 1271, "明": 1368, "清": 1644, "近现代": 1840,
}
ERA_END = {
    "春秋": -476, "战国": -221, "汉": 220, "南北朝": 589,
    "唐": 907, "宋": 1279, "元": 1368, "明": 1644, "清": 1912, "近现代": 2026,
}


# ========== 工具函数 ==========

def _normalize_era(era: str) -> str:
    """规范化朝代名称"""
    if not era:
        return "近现代"
    for e in ERA_ORDER:
        if e in era:
            return e
    return "近现代"


def _parse_techniques(item: HeritageItem) -> list[dict]:
    """解析 techniques_json，返回 [{name, desc}]"""
    if not item.techniques_json:
        return []
    try:
        return json.loads(item.techniques_json)
    except (json.JSONDecodeError, TypeError):
        return []


def _parse_images(item: HeritageItem) -> str:
    """获取第一张图片 URL"""
    if not item.images_json:
        return ""
    try:
        imgs = json.loads(item.images_json)
        return imgs[0] if imgs else ""
    except (json.JSONDecodeError, TypeError):
        return ""


# ========== ❶ 总览：品类-技法二分图 ==========

@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    """品类统计 + 跨品类共享技法 + 品类-技法连接"""
    items = db.query(HeritageItem).all()

    # 品类统计
    cat_items: dict[str, list[HeritageItem]] = defaultdict(list)
    for item in items:
        cat_items[item.category].append(item)

    categories = []
    for cat, group in sorted(cat_items.items()):
        regions = set()
        eras = set()
        all_techs = set()
        top_image = ""
        for it in group:
            if it.region:
                regions.add(extract_province(it.region))
            eras.add(_normalize_era(it.era))
            for t in _parse_techniques(it):
                all_techs.add(t.get("name", ""))
            if not top_image:
                top_image = _parse_images(it)

        categories.append({
            "name": cat,
            "item_count": len(group),
            "region_count": len(regions),
            "era_range": sorted(eras, key=lambda e: ERA_ORDER.index(e) if e in ERA_ORDER else 99),
            "technique_count": len(all_techs),
            "top_image": top_image,
        })

    # 全局技法索引: technique_name → [{category, item_name, era, desc}]
    tech_index: dict[str, list[dict]] = defaultdict(list)
    all_techniques = []
    seen_techs = set()
    for item in items:
        for t in _parse_techniques(item):
            tname = t.get("name", "")
            if not tname:
                continue
            tech_index[tname].append({
                "category": item.category,
                "item": item.name,
                "era": _normalize_era(item.era),
                "desc": t.get("desc", ""),
            })
            if tname not in seen_techs:
                seen_techs.add(tname)
                all_techniques.append({"name": tname, "desc": t.get("desc", ""), "category": item.category})

    # 共享技法（跨品类 ≥2）
    shared_techniques = []
    category_technique_links = []
    for tname, usages in sorted(tech_index.items()):
        cats = sorted(set(u["category"] for u in usages))
        items_set = set(u["item"] for u in usages)
        eras = [_normalize_era(u["era"]) for u in usages]
        earliest_era = min(eras, key=lambda e: ERA_ORDER.index(e) if e in ERA_ORDER else 99) if eras else ""

        if len(cats) >= 2:
            shared_techniques.append({
                "name": tname,
                "desc": usages[0].get("desc", ""),
                "category_count": len(cats),
                "categories": cats,
                "item_count": len(items_set),
                "earliest_era": earliest_era,
            })

        for cat in cats:
            count = sum(1 for u in usages if u["category"] == cat)
            category_technique_links.append({
                "source": cat,
                "target": tname,
                "strength": count,
            })

    return {
        "categories": categories,
        "shared_techniques": shared_techniques,
        "category_technique_links": category_technique_links,
        "all_techniques": all_techniques,
    }


# ========== ❷ 筛选后的项目节点+边 ==========

@router.get("/items")
def get_items(
    category: str = Query(default=""),
    region: str = Query(default=""),
    era: str = Query(default=""),
    technique: str = Query(default=""),
    db: Session = Depends(get_db),
):
    """按条件筛选非遗项目，返回力导向图节点+边"""
    q = db.query(HeritageItem)
    if category:
        q = q.filter(HeritageItem.category == category)
    if region:
        q = q.filter(HeritageItem.region.like(f"%{region}%"))
    if era:
        q = q.filter(HeritageItem.era.like(f"%{era}%"))
    if technique:
        # 过滤包含指定技法的项目
        q = q.filter(HeritageItem.techniques_json.like(f"%{technique}%"))

    items = q.all()

    # 构建节点
    nodes = []
    for item in items:
        techniques = _parse_techniques(item)
        nodes.append({
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "region": item.region or "",
            "era": item.era or "",
            "techniques": [t.get("name", "") for t in techniques],
            "symbolSize": max(20, 15 + len(techniques) * 5),
            "image": _parse_images(item),
        })

    # 构建边（品类相同 / 地域接近 / 技法相似）
    links = []
    seen = set()
    for i in range(len(items)):
        ti_names = set(t.get("name", "") for t in _parse_techniques(items[i]))
        pi = extract_province(items[i].region or "")
        for j in range(i + 1, len(items)):
            pair = (items[i].id, items[j].id)
            if pair in seen:
                continue

            # 品类相同
            if items[i].category == items[j].category:
                seen.add(pair)
                links.append({"source": items[i].id, "target": items[j].id, "relation": "品类相同", "shared_value": items[i].category})
                continue

            # 地域接近
            pj = extract_province(items[j].region or "")
            if pi and pj and pi == pj:
                seen.add(pair)
                links.append({"source": items[i].id, "target": items[j].id, "relation": "地域接近", "shared_value": pi})
                continue

            # 技法相似
            tj_names = set(t.get("name", "") for t in _parse_techniques(items[j]))
            common = ti_names & tj_names
            if common:
                seen.add(pair)
                links.append({"source": items[i].id, "target": items[j].id, "relation": "技法相似", "shared_value": list(common)[0]})

    return {"nodes": nodes, "links": links}


# ========== ❸ 技法详情 ==========

@router.get("/technique/{name}")
def get_technique_detail(name: str, db: Session = Depends(get_db)):
    """技法详情：使用品类、项目列表、时代分布"""
    items = db.query(HeritageItem).all()

    matched_items = []
    categories = set()
    era_dist = Counter()
    desc = ""

    for item in items:
        for t in _parse_techniques(item):
            if t.get("name") == name:
                matched_items.append({
                    "id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "era": item.era or "",
                    "region": item.region or "",
                })
                categories.add(item.category)
                era_dist[_normalize_era(item.era)] += 1
                if not desc and t.get("desc"):
                    desc = t["desc"]
                break

    # 相关技法：与这些项目共现的其他技法
    related = set()
    for item in items:
        if item.name in {m["name"] for m in matched_items}:
            for t in _parse_techniques(item):
                if t.get("name") != name:
                    related.add(t.get("name", ""))

    return {
        "name": name,
        "desc": desc,
        "categories": sorted(categories),
        "items": matched_items,
        "era_distribution": dict(era_dist),
        "related_techniques": sorted(related),
    }


# ========== ❹ 相关项目推荐 ==========

@router.get("/items/{item_id}/related")
def get_related_items(item_id: int, db: Session = Depends(get_db)):
    """根据项目 ID 获取同类/同地区/共享技法的相关项目"""
    item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
    if not item:
        return {"item": {}, "same_category": [], "same_region": [], "shared_techniques": []}

    item_techs = {t.get("name", "") for t in _parse_techniques(item)}
    item_province = extract_province(item.region or "")

    item_data = {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        "region": item.region or "",
        "era": item.era or "",
        "description": item.description or "",
        "techniques": [{"name": t.get("name", ""), "desc": t.get("desc", "")} for t in _parse_techniques(item)],
        "inheritors": json.loads(item.inheritors_json) if item.inheritors_json else [],
        "images": json.loads(item.images_json) if item.images_json else [],
        "cultural_meaning": item.cultural_meaning or "",
    }

    all_items = db.query(HeritageItem).filter(HeritageItem.id != item_id).all()

    same_category = []
    same_region = []
    shared_techniques = []

    for other in all_items:
        entry = {
            "id": other.id,
            "name": other.name,
            "category": other.category,
            "region": other.region or "",
            "era": other.era or "",
            "image": _parse_images(other),
        }
        if other.category == item.category and len(same_category) < 5:
            same_category.append(entry)
        if item_province and extract_province(other.region or "") == item_province and len(same_region) < 5:
            same_region.append(entry)
        other_techs = {t.get("name", "") for t in _parse_techniques(other)}
        if item_techs & other_techs and len(shared_techniques) < 5:
            shared_techniques.append(entry)

    return {
        "item": item_data,
        "same_category": same_category,
        "same_region": same_region,
        "shared_techniques": shared_techniques,
    }


# ========== ❺ 增强地域分布（含坐标 + 品类分布） ==========

@router.get("/regions")
def get_regions(db: Session = Depends(get_db)):
    """地域分布数据 — 含省份坐标 + 品类分布 + 热门技法"""
    items = db.query(HeritageItem).all()

    region_map: dict[str, dict] = {}
    for item in items:
        if not item.region:
            continue
        province = extract_province(item.region)
        if not province:
            continue

        if province not in region_map:
            region_map[province] = {
                "name": province,
                "value": 0,
                "coords": get_province_coords(item.region),
                "items": [],
                "categories": set(),
                "technique_counter": Counter(),
            }

        region_map[province]["value"] += 1
        region_map[province]["items"].append(item.name)
        region_map[province]["categories"].add(item.category)
        for t in _parse_techniques(item):
            region_map[province]["technique_counter"][t.get("name", "")] += 1

    result = []
    for prov, data in sorted(region_map.items()):
        result.append({
            "name": data["name"],
            "value": data["value"],
            "coords": data["coords"],
            "items": data["items"],
            "categories": sorted(data["categories"]),
            "top_techniques": [t for t, _ in data["technique_counter"].most_common(5)],
        })

    return sorted(result, key=lambda x: x["value"], reverse=True)


# ========== ❻ 增强时间轴（含新技法 + 品类分布） ==========

@router.get("/timeline")
def get_timeline(db: Session = Depends(get_db)):
    """时间轴数据 — 按朝代分组，含新技法 + 品类分布"""
    items = db.query(HeritageItem).all()

    # 先统计每个技法最早出现的朝代
    tech_first_era: dict[str, str] = {}
    for item in items:
        era_norm = _normalize_era(item.era)
        for t in _parse_techniques(item):
            tname = t.get("name", "")
            if not tname:
                continue
            if tname not in tech_first_era:
                tech_first_era[tname] = era_norm
            else:
                # 保留更早的
                current_idx = ERA_ORDER.index(tech_first_era[tname]) if tech_first_era[tname] in ERA_ORDER else 99
                new_idx = ERA_ORDER.index(era_norm) if era_norm in ERA_ORDER else 99
                if new_idx < current_idx:
                    tech_first_era[tname] = era_norm

    # 按朝代分组
    era_map: dict[str, dict] = {}
    for item in items:
        era_norm = _normalize_era(item.era)

        if era_norm not in era_map:
            era_map[era_norm] = {
                "era": era_norm,
                "start": ERA_START.get(era_norm, 0),
                "end": ERA_END.get(era_norm, 0),
                "items": [],
                "distribution": Counter(),
                "category_breakdown": Counter(),
                "techniques_introduced": [],
            }

        era_map[era_norm]["items"].append({
            "id": item.id,
            "name": item.name,
            "category": item.category,
            "image": _parse_images(item),
        })

        if item.region:
            era_map[era_norm]["distribution"][extract_province(item.region)] += 1

        era_map[era_norm]["category_breakdown"][item.category] += 1

    # 每个朝代新出现的技法
    for tname, era_norm in tech_first_era.items():
        if era_norm in era_map:
            era_map[era_norm]["techniques_introduced"].append(tname)

    # 按朝代顺序排序，转换 Counter 为 dict
    result = []
    for era in ERA_ORDER:
        if era in era_map:
            entry = era_map[era]
            entry["distribution"] = dict(entry["distribution"])
            entry["category_breakdown"] = dict(entry["category_breakdown"])
            result.append(entry)

    return result


# ========== ❼ 时代背景（时空叙事新增） ==========

ERA_CONTEXT_CACHE: dict | None = None


def _load_era_contexts() -> dict:
    """加载朝代背景 JSON（懒加载 + 内存缓存）"""
    global ERA_CONTEXT_CACHE
    if ERA_CONTEXT_CACHE is not None:
        return ERA_CONTEXT_CACHE

    context_path = Path(__file__).resolve().parent.parent.parent / "data" / "knowledge" / "era_contexts.json"
    if context_path.exists():
        try:
            with open(context_path, "r", encoding="utf-8") as f:
                ERA_CONTEXT_CACHE = json.load(f)
            logger.info(f"Loaded era contexts from {context_path}")
            return ERA_CONTEXT_CACHE
        except (json.JSONDecodeError, IOError) as e:
            logger.warning(f"Failed to load era_contexts.json: {e}")

    ERA_CONTEXT_CACHE = {}
    return ERA_CONTEXT_CACHE


@router.get("/era-context")
def get_era_context(era: str = Query(..., description="朝代名称，如 '唐'、'明清'")):
    """获取指定朝代的政治/经济/文化背景"""
    contexts = _load_era_contexts()

    # 精确匹配
    if era in contexts:
        entry = contexts[era]
        entry["era"] = era
        return entry

    # 模糊匹配：检查 era 是否包含在 key 中，或 key 是否包含在 era 中
    for key, entry in contexts.items():
        if key in era or era in key:
            entry["era"] = key
            return entry

    # 未匹配时返回通用描述
    return {
        "era": era,
        "politics": f"关于{era}时期的历史资料正在整理中。",
        "economy": f"关于{era}时期的经济状况资料正在整理中。",
        "culture": f"关于{era}时期的文化特征资料正在整理中。",
        "craft_relevance": f"关于{era}时期的非遗技艺发展资料正在整理中。",
    }


# ========== ❽ 传承时间线（时空叙事新增） ==========

def _build_fallback_timeline(item: HeritageItem, inheritors: list, techniques: list) -> list[dict]:
    """基于数据库已有数据构建降级时间线（不调用 LLM）"""
    events = []

    # 技艺起源事件
    if item.era:
        events.append({
            "era": item.era,
            "event_type": "origin",
            "description": f"{item.name}最早可追溯至{item.era}时期，在{item.region}地区形成独特的技艺传统。",
            "related_person": "",
        })

    # 传承人事件
    for inh in inheritors[:5]:
        era_hint = ""
        if item.era:
            era_hint = f"（{item.era}至今）"
        events.append({
            "era": item.era or "近现代",
            "event_type": "inheritor",
            "description": f"{inh.get('name', '')}（{inh.get('title', '')}）：{inh.get('desc', '')[:150]}{era_hint}",
            "related_person": inh.get("name", ""),
        })

    # 技法事件
    for t in techniques[:5]:
        events.append({
            "era": item.era or "近现代",
            "event_type": "evolution",
            "description": f"核心技法「{t.get('name', '')}」：{t.get('desc', '')[:200]}",
            "related_person": "",
        })

    return events


@router.get("/items/{item_id}/heritage-timeline")
def get_heritage_timeline(item_id: int, db: Session = Depends(get_db)):
    """获取非遗项目的传承时间线（LLM 增强 + 降级兜底）"""
    item = db.query(HeritageItem).filter(HeritageItem.id == item_id).first()
    if not item:
        from app.utils.exceptions import AppException
        raise AppException("项目不存在", code=404)

    inheritors = json.loads(item.inheritors_json) if item.inheritors_json else []
    techniques = _parse_techniques(item)

    # 尝试 LLM 生成
    try:
        from app.services.ai.llm import chat

        ctx = {
            "name": item.name,
            "category": item.category,
            "era": item.era or "未知",
            "region": item.region or "未知",
            "description": (item.description or "")[:500],
            "cultural_meaning": (item.cultural_meaning or "")[:300],
            "inheritors": [{"name": i.get("name"), "title": i.get("title"), "desc": i.get("desc", "")[:200]} for i in inheritors[:5]],
            "techniques": [{"name": t.get("name"), "desc": t.get("desc", "")[:150]} for t in techniques[:5]],
        }

        prompt = f"""你是一位中国非物质文化遗产研究专家。请为以下非遗项目生成「传承时间线」，按朝代顺序列出关键事件。

非遗项目信息：
```json
{json.dumps(ctx, ensure_ascii=False, indent=2)}
```

请返回 JSON 数组（不要包含其他文字），每个事件包含：
- era: 朝代/时期（如"唐代""宋代""明清""近现代"）
- event_type: 事件类型，取 "origin"(技艺起源)、"evolution"(技艺变革)、"inheritor"(传承人)、"event"(历史事件) 之一
- description: 事件描述（80-150字，有历史依据）
- related_person: 相关人物姓名（没有则为空字符串）

要求：
1. 按时间顺序排列（从古到今）
2. 至少包含 3 个事件，最多 7 个
3. 技艺起源和传承人必须有数据依据
4. 如果某项信息不足，跳过该类型事件
5. 只返回 JSON 数组，不要包含任何其他文字"""

        messages = [{"role": "user", "content": prompt}]
        text = chat(messages)

        # 尝试解析 JSON
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        timeline = json.loads(text)
        if isinstance(timeline, list) and len(timeline) > 0:
            logger.info(f"LLM generated timeline for item {item_id}: {len(timeline)} events")
            return {"item_id": item_id, "item_name": item.name, "timeline": timeline}
    except Exception as e:
        logger.warning(f"LLM timeline generation failed for item {item_id}: {e}, using fallback")

    # 降级兜底
    fallback = _build_fallback_timeline(item, inheritors, techniques)
    return {"item_id": item_id, "item_name": item.name, "timeline": fallback}
