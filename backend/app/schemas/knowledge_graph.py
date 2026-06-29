"""知识图谱相关 Pydantic Schema"""

from pydantic import BaseModel


# === Overview（品类-技法总览） ===

class CategoryStat(BaseModel):
    name: str
    item_count: int
    region_count: int
    era_range: list[str] = []
    technique_count: int
    top_image: str = ""


class SharedTechnique(BaseModel):
    name: str
    desc: str = ""
    category_count: int
    categories: list[str] = []
    item_count: int
    earliest_era: str = ""


class CategoryTechniqueLink(BaseModel):
    source: str   # category name
    target: str   # technique name
    strength: int  # how many items in that category use this technique


class OverviewResponse(BaseModel):
    categories: list[CategoryStat] = []
    shared_techniques: list[SharedTechnique] = []
    category_technique_links: list[CategoryTechniqueLink] = []
    all_techniques: list[dict] = []  # [{name, desc, category}]


# === Items（筛选后的项目节点+边） ===

class ItemNode(BaseModel):
    id: int
    name: str
    category: str
    region: str
    era: str
    techniques: list[str] = []
    symbolSize: int = 20
    image: str = ""


class ItemLink(BaseModel):
    source: int
    target: int
    relation: str         # "技法相似" | "地域接近" | "品类相同"
    shared_value: str = ""  # 共享的技法名/地区名


class ItemsResponse(BaseModel):
    nodes: list[ItemNode] = []
    links: list[ItemLink] = []


# === Technique Detail ===

class TechniqueDetailResponse(BaseModel):
    name: str
    desc: str = ""
    categories: list[str] = []
    items: list[dict] = []           # [{id, name, category, era, region}]
    era_distribution: dict[str, int] = {}  # {era: count}
    related_techniques: list[str] = []


class TechniqueEvolutionResponse(BaseModel):
    technique: str
    chain: list[dict] = []  # [{era, start, end, items: [{id, name, category}]}]


# === Related Items ===

class RelatedItemsResponse(BaseModel):
    item: dict = {}                    # full heritage item data
    same_category: list[dict] = []     # [{id, name, category, region, era, image}]
    same_region: list[dict] = []
    shared_techniques: list[dict] = []


# === Enhanced Regions ===

class RegionItem(BaseModel):
    name: str
    value: int
    coords: list[float] = []          # [lon, lat]
    items: list[str] = []
    categories: list[str] = []        # which categories are in this province
    top_techniques: list[str] = []    # top 5 technique names


# === Enhanced Timeline ===

class TimelineEraItem(BaseModel):
    era: str
    start: int
    end: int
    items: list[dict] = []            # [{id, name, category}]
    distribution: dict[str, int] = {}  # {province: count}
    techniques_introduced: list[str] = []  # new techniques first appearing in this era
    category_breakdown: dict[str, int] = {}  # {category: count}
