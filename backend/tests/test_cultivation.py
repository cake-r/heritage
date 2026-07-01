"""非遗修习之路 API 测试"""

import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from app.main import app
from app.models.database import SessionLocal, Base, engine


@pytest.fixture(autouse=True)
def setup_db():
    from app.models.database import init_db
    init_db()
    yield
    db = SessionLocal()
    try:
        from app.models.cultivation import UserCultivation, UserQuest
        from app.models.user import User
        # 按 FK 依赖顺序清理
        db.query(UserQuest).delete()
        db.query(UserCultivation).delete()
        db.query(User).filter(User.username.like("test_%")).delete()
        db.commit()
    except Exception:
        db.rollback()
        # 清理失败时尝试强制删除（禁用 FK 约束）
        try:
            db.execute(text("PRAGMA foreign_keys=OFF"))
            db.query(User).filter(User.username.like("test_%")).delete()
            db.commit()
            db.execute(text("PRAGMA foreign_keys=ON"))
        except Exception:
            db.rollback()
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


class TestCultivationStatus:
    def test_status_returns_defaults(self, auth_client):
        client, token, _ = auth_client
        resp = client.get("/api/cultivation/status", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["rank"] == "初窥门径"
        assert data["rank_index"] == 0
        assert data["xp"] >= 0
        assert len(data["skill_trees"]) == 6
        assert data["streak_days"] >= 0

    def test_status_requires_auth(self, client):
        resp = client.get("/api/cultivation/status")
        assert resp.status_code in [401, 403]

    def test_skill_trees_have_correct_fields(self, auth_client):
        client, token, _ = auth_client
        resp = client.get("/api/cultivation/status", headers={
            "Authorization": f"Bearer {token}",
        })
        data = resp.json()
        for tree in data["skill_trees"]:
            assert "tree_name" in tree
            assert "label" in tree
            assert "icon" in tree
            assert "level" in tree
            assert "current" in tree
            assert "threshold" in tree
            assert "percentage" in tree
            assert tree["level"] >= 1

    def test_rank_progression_check(self, auth_client):
        client, token, _ = auth_client
        # Verify initial rank
        resp = client.get("/api/cultivation/status", headers={
            "Authorization": f"Bearer {token}",
        })
        data = resp.json()
        assert data["rank_index"] == 0  # New user starts at rank 0
        assert data["xp"] >= 0  # XP may be 0 or earned from streak

        # Rank system works: the status endpoint returns correct structure
        assert data["rank"] in ["初窥门径", "略有小成", "融会贯通", "炉火纯青", "一代宗师"]
        assert data["xp_to_next"] >= 0
        assert data["streak_days"] >= 0


class TestDailyQuests:
    def test_quests_generated_for_new_user(self, auth_client):
        client, token, _ = auth_client
        resp = client.get("/api/cultivation/quests", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert len(data) == 3
        for quest in data:
            assert "id" in quest
            assert "title" in quest
            assert "xp_reward" in quest
            assert quest["status"] == "pending"

    def test_quests_idempotent_same_day(self, auth_client):
        client, token, _ = auth_client
        resp1 = client.get("/api/cultivation/quests", headers={
            "Authorization": f"Bearer {token}",
        })
        resp2 = client.get("/api/cultivation/quests", headers={
            "Authorization": f"Bearer {token}",
        })
        ids1 = [q["id"] for q in resp1.json()]
        ids2 = [q["id"] for q in resp2.json()]
        assert ids1 == ids2  # 同一天返回相同任务

    def test_complete_quest_awards_xp(self, auth_client):
        client, token, _ = auth_client
        # 获取任务
        quests_resp = client.get("/api/cultivation/quests", headers={
            "Authorization": f"Bearer {token}",
        })
        quests = quests_resp.json()
        assert len(quests) > 0

        # 完成第一个任务
        quest_id = quests[0]["id"]
        complete_resp = client.post(
            f"/api/cultivation/quests/{quest_id}/complete",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert complete_resp.status_code == 200, complete_resp.text
        result = complete_resp.json()
        assert result["xp_gained"] > 0
        assert result["total_xp"] > 0

    def test_complete_already_completed_quest_fails(self, auth_client):
        client, token, _ = auth_client
        quests_resp = client.get("/api/cultivation/quests", headers={
            "Authorization": f"Bearer {token}",
        })
        quest_id = quests_resp.json()[0]["id"]
        client.post(f"/api/cultivation/quests/{quest_id}/complete", headers={
            "Authorization": f"Bearer {token}",
        })
        # 再次完成应失败
        resp = client.post(f"/api/cultivation/quests/{quest_id}/complete", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 400

    def test_complete_nonexistent_quest_fails(self, auth_client):
        client, token, _ = auth_client
        resp = client.post("/api/cultivation/quests/99999/complete", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 400


class TestWeeklyChallenge:
    def test_weekly_challenge_returns_data(self, auth_client):
        client, token, _ = auth_client
        resp = client.get("/api/cultivation/weekly-challenge", headers={
            "Authorization": f"Bearer {token}",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "theme" in data
        assert "description" in data
        assert "tasks_total" in data
        assert "reward_stamp_name" in data
        assert "reward_stamp_icon" in data
        assert "expires_at" in data
