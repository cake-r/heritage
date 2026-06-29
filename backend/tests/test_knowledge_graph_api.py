"""文化图谱API测试"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    return TestClient(app)


def test_get_overview(client):
    """获取品类-技法总览"""
    resp = client.get("/api/knowledge-graph/overview")
    assert resp.status_code == 200
    data = resp.json()
    assert "categories" in data
    assert "shared_techniques" in data
    assert "category_technique_links" in data
    assert isinstance(data["categories"], list)


def test_get_items(client):
    """获取筛选后的项目节点+边"""
    resp = client.get("/api/knowledge-graph/items")
    assert resp.status_code == 200
    data = resp.json()
    assert "nodes" in data
    assert "links" in data
    assert isinstance(data["nodes"], list)
    assert isinstance(data["links"], list)


def test_get_items_nodes_have_required_fields(client):
    """项目节点结构检查"""
    resp = client.get("/api/knowledge-graph/items")
    nodes = resp.json()["nodes"]
    if nodes:
        node = nodes[0]
        assert "id" in node
        assert "name" in node
        assert "category" in node
        assert "techniques" in node


def test_get_items_with_category_filter(client):
    """按品类筛选项目"""
    resp = client.get("/api/knowledge-graph/items?category=刺绣")
    assert resp.status_code == 200
    data = resp.json()
    for node in data["nodes"]:
        assert node["category"] == "刺绣"


def test_get_technique_detail(client):
    """获取技法详情"""
    resp = client.get("/api/knowledge-graph/technique/掐丝")
    assert resp.status_code == 200
    data = resp.json()
    assert "name" in data
    assert "categories" in data
    assert "items" in data


def test_get_related_items(client):
    """获取相关项目推荐"""
    resp = client.get("/api/knowledge-graph/items/1/related")
    assert resp.status_code == 200
    data = resp.json()
    assert "item" in data
    assert "same_category" in data
    assert "same_region" in data
    assert "shared_techniques" in data


def test_get_regions(client):
    """获取地域分布（增强版含坐标+品类）"""
    resp = client.get("/api/knowledge-graph/regions")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        region = data[0]
        assert "name" in region
        assert "value" in region
        assert "items" in region
        assert "coords" in region
        assert "categories" in region


def test_get_timeline(client):
    """获取时间轴（增强版含新技法+品类分布）"""
    resp = client.get("/api/knowledge-graph/timeline")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        era = data[0]
        assert "era" in era
        assert "items" in era
        assert "distribution" in era
        assert "techniques_introduced" in era
        assert "category_breakdown" in era


def test_timeline_sorted_by_era(client):
    """时间轴按朝代顺序排列"""
    resp = client.get("/api/knowledge-graph/timeline")
    data = resp.json()
    if len(data) >= 2:
        # 验证earlier start values appear first
        assert data[0]["start"] <= data[-1]["start"]
