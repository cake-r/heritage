"""模块⑤ 非遗文化图谱 API — 统一非遗探索"""

import json
import logging
from collections import Counter, defaultdict

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
