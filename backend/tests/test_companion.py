"""AI 智能伴游 API 测试"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal, Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    db = SessionLocal()
    try:
        from app.models.recommendation import UserInterestProfile
        from app.models.cultivation import UserCultivation, UserQuest
        from app.models.user import User
        db.query(UserQuest).delete()
        db.query(UserCultivation).delete()
        db.query(UserInterestProfile).delete()
        db.query(User).filter(User.username.like("test_%")).delete()
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_client(client):
    username = f"test_{uuid.uuid4().hex[:8]}"
    resp = client.post("/api/auth/register", json={
        "username": username, "password": "test123456",
    })
    token = resp.json()["access_token"]
    return client, token, username


class TestCompanionSuggest:
    def test_suggest_returns_list(self, auth_client):
        client, token, _ = auth_client
        resp = client.post("/api/companion/suggest", json={
            "page": "/",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert isinstance(data, list)
        # Mock 模式下应返回 1-3 条建议
        assert 1 <= len(data) <= 3

    def test_suggest_items_have_required_fields(self, auth_client):
        client, token, _ = auth_client
        resp = client.post("/api/companion/suggest", json={
            "page": "/",
        }, headers={"Authorization": f"Bearer {token}"})
        for item in resp.json():
            assert "id" in item
            assert "title" in item
            assert "description" in item
            assert "target_route" in item
            assert "icon" in item
            assert "confidence" in item
            assert "category" in item
            assert item["confidence"] >= 0.6

    def test_suggest_requires_auth(self, client):
        resp = client.post("/api/companion/suggest", json={"page": "/"})
        assert resp.status_code in [401, 403]

    def test_suggest_with_context_hint(self, auth_client):
        client, token, _ = auth_client
        resp = client.post("/api/companion/suggest", json={
            "page": "/recognition",
            "context_hint": "just_completed_recognition",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200, resp.text
        assert isinstance(resp.json(), list)

    def test_suggest_various_pages(self, auth_client):
        client, token, _ = auth_client
        for page in ["/", "/recognition", "/exhibition", "/workshop", "/knowledge-graph"]:
            resp = client.post("/api/companion/suggest", json={
                "page": page,
            }, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)

    def test_frequency_control(self, auth_client):
        client, token, _ = auth_client
        # 第一次调用
        resp1 = client.post("/api/companion/suggest", json={
            "page": "/recognition",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp1.status_code == 200

        # 立即第二次调用同一页 — 应被频率控制拦截
        resp2 = client.post("/api/companion/suggest", json={
            "page": "/recognition",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp2.status_code == 200
        # 频率控制应返回空列表
        assert resp2.json() == []

        # 不同页面应不受影响
        resp3 = client.post("/api/companion/suggest", json={
            "page": "/exhibition",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp3.status_code == 200
        assert len(resp3.json()) >= 1


class TestCompanionContext:
    def test_context_returns_summary(self, auth_client):
        client, token, _ = auth_client
        resp = client.get("/api/companion/context", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "user_summary" in data
        assert "recent_activity" in data
        assert "pending_quests" in data
        assert "recommended_modules" in data
        assert isinstance(data["recent_activity"], list)
        assert isinstance(data["recommended_modules"], list)

    def test_context_requires_auth(self, client):
        resp = client.get("/api/companion/context")
        assert resp.status_code in [401, 403]

    def test_context_new_user(self, auth_client):
        client, token, _ = auth_client
        resp = client.get("/api/companion/context", headers={
            "Authorization": f"Bearer {token}",
        })
        data = resp.json()
        # 新用户应有欢迎摘要
        assert len(data["user_summary"]) > 0
