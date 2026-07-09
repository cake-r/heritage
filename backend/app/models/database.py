"""SQLAlchemy 数据库引擎与Session — 支持 SQLite 与 PostgreSQL"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL, USE_SQLITE, USE_POSTGRES, BASE_DIR

# 根据数据库方言构造引擎参数
if USE_SQLITE:
    connect_args = {"check_same_thread": False}
    engine_kwargs: dict = {}
elif USE_POSTGRES:
    connect_args = {}
    engine_kwargs = {
        "pool_size": 20,         # 连接池大小
        "max_overflow": 10,      # 超出 pool_size 的最大连接数
        "pool_recycle": 3600,    # 1 小时后回收连接
        "pool_pre_ping": True,   # 使用前检查连接是否有效
    }
else:
    connect_args = {}
    engine_kwargs = {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,
    **engine_kwargs,
)

# SQLite: 启用外键约束 + WAL 模式 (MOCK_MODE 下跳过 WAL)
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if USE_SQLITE:
        import os
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        if os.getenv("MOCK_MODE", "false").lower() != "true":
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI依赖注入: 获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """创建所有表 — 在应用启动时调用"""
    # 确保所有模型被导入以便 Base.metadata 发现
    import app.models.user  # noqa: F401
    import app.models.recognition  # noqa: F401
    import app.models.generation  # noqa: F401
    import app.models.favorite  # noqa: F401
    import app.models.chat  # noqa: F401
    import app.models.exhibition  # noqa: F401
    import app.models.custom_inheritor  # noqa: F401
    import app.models.restoration  # noqa: F401
    import app.models.passport  # noqa: F401
    import app.models.expansion  # noqa: F401
    import app.models.recommendation  # noqa: F401
    import app.models.cultivation  # noqa: F401
    import app.models.companion  # noqa: F401
    import app.models.ai_usage  # noqa: F401
    import app.models.async_task  # noqa: F401
    import app.models.heritage_chunk  # noqa: F401
    import app.models.pattern_gene  # noqa: F401
    import app.models.restoration_archive  # noqa: F401
    import app.models.user_region_progress  # noqa: F401
    import app.models.prompt  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # 迁移: 为已有数据库添加新列
    _migrate_add_column("heritage_items", "embedding_json", "TEXT")
    _migrate_add_column("chat_messages", "voice_url", "VARCHAR(500)")
    _migrate_add_column("user_uploads", "region", "VARCHAR(100)")
    _migrate_add_column("user_uploads", "era", "VARCHAR(100)")
    _migrate_add_column("user_uploads", "techniques_json", "TEXT")
    _migrate_add_column("user_uploads", "inheritors_json", "TEXT")
    _migrate_add_column("user_uploads", "cultural_meaning", "TEXT")
    _migrate_add_column("passport_stamps", "progress", "INTEGER DEFAULT 1")
    _migrate_add_column("recognition_records", "heatmap_data_json", "TEXT")
    _migrate_add_column("user_cultivation", "streak_days", "INTEGER DEFAULT 0")
    _migrate_add_column("user_cultivation", "last_active_date", "DATE")
    _migrate_add_column("user_cultivation", "longest_streak", "INTEGER DEFAULT 0")
    _migrate_add_column("user_cultivation", "streak_freezes", "INTEGER DEFAULT 0")
    _migrate_add_column("user_quests", "condition_type", "VARCHAR(30)")
    _migrate_add_column("user_quests", "condition_threshold", "FLOAT")
    _migrate_add_column("user_quests", "condition_progress", "FLOAT DEFAULT 0")
    _migrate_add_column("users", "role", "VARCHAR(20) DEFAULT 'user'")
    _migrate_add_column("users", "is_banned", "BOOLEAN DEFAULT 0")
    _migrate_add_column("users", "banned_at", "DATETIME")
    _migrate_add_column("users", "banned_reason", "VARCHAR(300)")
    _migrate_add_column("heritage_items", "reason_text", "VARCHAR(120)")

    # 自动种子数据: 确保数据库重建后非遗展厅数据不丢失
    _seed_heritage_if_empty()

    # 自动种子纹样基因库
    _seed_pattern_genes_if_empty()

    # 增量迁移: 已有数据的库也需要新增纹样
    _migrate_pattern_genes()

    # 自动种子 Prompt 默认版本
    _seed_prompts_if_empty()


def _seed_heritage_if_empty():
    """如果 heritage_items 表为空, 自动从 JSON 导入种子数据

    确保数据库重建后非遗展厅数据不会丢失。
    已有数据时幂等跳过 (与 seed_knowledge.py 逻辑一致)。
    """
    import json
    from pathlib import Path

    json_path = BASE_DIR / "data" / "knowledge" / "heritage_sample.json"
    if not json_path.exists():
        return

    db = SessionLocal()
    try:
        from app.models.exhibition import HeritageItem
        if db.query(HeritageItem).count() > 0:
            return  # 已有数据, 跳过

        with open(json_path, "r", encoding="utf-8") as f:
            items = json.load(f)

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
        print(f"[init_db] 自动导入完成: {len(items)} 条非遗数据")
    except Exception as e:
        db.rollback()
        print(f"[init_db] 种子数据导入失败 (可手动运行 seed_knowledge.py): {e}")
    finally:
        db.close()


def _seed_pattern_genes_if_empty():
    """如果 pattern_genes 表为空, 自动从 JSON 导入种子数据"""
    import json
    from pathlib import Path

    json_path = BASE_DIR / "data" / "knowledge" / "pattern_genes.json"
    if not json_path.exists():
        return

    db = SessionLocal()
    try:
        from app.models.pattern_gene import PatternGene
        if db.query(PatternGene).count() > 0:
            return  # 已有数据, 跳过

        with open(json_path, "r", encoding="utf-8") as f:
            genes = json.load(f)

        for g in genes:
            pg = PatternGene(
                gene_id=g["gene_id"],
                name=g["name"],
                shape_category=g["shape_category"],
                meaning=g.get("meaning"),
                era=g.get("era"),
                region=g.get("region"),
                description=g.get("description"),
                svg_viewbox=g.get("svg_viewbox", "0 0 100 100"),
                svg_content=g.get("svg_content", ""),
                default_color=g.get("default_color", "#B8463A"),
                tags_json=json.dumps(g.get("tags", []), ensure_ascii=False),
            )
            db.add(pg)
        db.commit()
        print(f"[init_db] 纹样基因库导入完成: {len(genes)} 个纹样")
    except Exception as e:
        db.rollback()
        print(f"[init_db] 纹样基因库导入失败: {e}")
    finally:
        db.close()


def _migrate_pattern_genes():
    """增量迁移: 将 pattern_genes.json 中新增的纹样插入已有数据库

    与 _seed_pattern_genes_if_empty() 不同, 此函数仅插入缺失的 gene_id,
    不影响已存在的纹样数据。适用于已有部署升级场景。
    """
    import json
    from pathlib import Path

    json_path = BASE_DIR / "data" / "knowledge" / "pattern_genes.json"
    if not json_path.exists():
        return

    db = SessionLocal()
    try:
        from app.models.pattern_gene import PatternGene

        with open(json_path, "r", encoding="utf-8") as f:
            genes = json.load(f)

        existing_ids = {g[0] for g in db.query(PatternGene.gene_id).all()}
        new_count = 0

        for g in genes:
            if g["gene_id"] not in existing_ids:
                pg = PatternGene(
                    gene_id=g["gene_id"],
                    name=g["name"],
                    shape_category=g["shape_category"],
                    meaning=g.get("meaning"),
                    era=g.get("era"),
                    region=g.get("region"),
                    description=g.get("description"),
                    svg_viewbox=g.get("svg_viewbox", "0 0 100 100"),
                    svg_content=g.get("svg_content", ""),
                    default_color=g.get("default_color", "#B8463A"),
                    tags_json=json.dumps(g.get("tags", []), ensure_ascii=False),
                )
                db.add(pg)
                new_count += 1

        if new_count > 0:
            db.commit()
            print(f"[init_db] 纹样基因库增量迁移: 新增 {new_count} 个纹样")
    except Exception as e:
        db.rollback()
        print(f"[init_db] 纹样基因库增量迁移失败: {e}")
    finally:
        db.close()


def _migrate_add_column(table: str, column: str, col_type: str):
    """安全添加列 — 仅在列不存在时执行 (SQLite only)"""
    if not USE_SQLITE:
        return
    import sqlite3
    from pathlib import Path
    try:
        # 从 DATABASE_URL 提取文件路径
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if not Path(db_path).is_absolute():
            from app.config import BASE_DIR
            db_path = str(BASE_DIR / db_path)
        conn = sqlite3.connect(db_path)
        cols = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
            conn.commit()
        conn.close()
    except Exception:
        pass


def _seed_prompts_if_empty():
    """如果 prompts 表为空, 自动导入 5 个模块的默认 Prompt v1（Phase C Step 8）"""
    db = SessionLocal()
    try:
        from app.models.prompt import Prompt
        if db.query(Prompt).count() > 0:
            return  # 已有数据, 跳过

        defaults = {
            "recognition": _default_recognition_prompt(),
            "companion": _default_companion_prompt(),
            "generation": _default_generation_prompt(),
            "story": _default_story_prompt(),
            "recommendation": _default_recommendation_prompt(),
        }

        for module, content in defaults.items():
            db.add(Prompt(
                module=module,
                version=1,
                content=content,
                is_active=True,
                description="系统默认 Prompt v1（自动种子）",
            ))
        db.commit()
        print("[init_db] Prompt 默认版本导入完成: 5 个模块")
    except Exception as e:
        db.rollback()
        print(f"[init_db] Prompt 种子导入失败: {e}")
    finally:
        db.close()


def _default_recognition_prompt() -> str:
    return """Identify this image as a Chinese Intangible Cultural Heritage (ICH) handicraft category.

Try your best to match the image to the closest ICH category, even for non-perfect matches (modern reproductions, partial views, decorative items inspired by traditional crafts). Only use "无法识别" if the image has NO connection whatsoever to Chinese traditional crafts (e.g., purely modern objects like cars, Western-style portraits, natural landscapes without cultural elements).

Return strictly in JSON format:
{
  "category": "ICH category name, use '无法识别' only as last resort",
  "confidence": 0.85,
  "top3": [
    {"category": "category1", "confidence": 0.85},
    {"category": "category2", "confidence": 0.10},
    {"category": "category3", "confidence": 0.05}
  ],
  "features": ["feature1", "feature2", "feature3"],
  "pattern_names": ["云纹", "回纹", "缠枝纹"],
  "description": "Detailed visual description including patterns, techniques, materials, colors, style era (80-150 words)"
}

Important rules:
- confidence: reflect how certain you are. 0.85+ for clear matches, 0.5-0.85 for plausible but uncertain, below 0.5 only for pure guesses.
- top3 confidences MUST sum to 1.0.
- features: list 3-5 observable craft techniques or visual characteristics.
- pattern_names: list up to 5 traditional Chinese decorative patterns/motifs visible in the image.
- Return ONLY the category name without prefix for ICH categories."""


def _default_companion_prompt() -> str:
    return """你是一位非遗文化导游「灵儿」，性格温柔亲切，对各类非遗文化知识了如指掌。

你的职责：
1. 根据用户当前浏览/识别的非遗内容，提供有趣的文化背景故事
2. 用轻松自然的语气，像朋友聊天一样介绍非遗知识
3. 适时推荐用户可能感兴趣的其他非遗项目
4. 回答用户关于非遗的任何问题

回复要求：
- 语言自然口语化，不要教科书式的长篇大论
- 每次回复控制在 100-200 字
- 适当使用 emoji 增加亲切感
- 如果不确定，诚实告知并建议用户查阅专业资料"""


def _default_generation_prompt() -> str:
    return """You are a creative prompt engineer for Chinese Intangible Cultural Heritage (ICH) themed image generation.

Given a user's creative idea and preferred style, generate a detailed image generation prompt in English that:
1. Incorporates the specified ICH style elements (patterns, colors, techniques)
2. Creates an aesthetically pleasing composition
3. Is specific and detailed enough for text-to-image generation
4. Maintains cultural authenticity while allowing creative freedom

The prompt should be 50-100 words, vivid and descriptive, suitable for DALL-E / Midjourney / Stable Diffusion style image generation."""


def _default_story_prompt() -> str:
    return """你是一位非遗文化故事讲述者，擅长将非遗技艺、文物、传承人的故事以生动有趣的方式呈现。

讲述风格：
1. 开头用悬念或有趣的细节吸引注意力
2. 融入历史背景但不枯燥，像讲一个生动的故事
3. 适当加入传承人的真实经历或民间传说
4. 结尾点出这项非遗的文化意义

故事长度 300-500 字，适合口语讲述。"""


def _default_recommendation_prompt() -> str:
    return """你是一个非遗文化推荐引擎。根据用户的兴趣画像（品类偏好、地域偏好、年代偏好、互动历史），从知识库中推荐最匹配的非遗项目。

推荐策略：
1. 优先推荐与用户高频互动品类相关的项目
2. 其次考虑用户所在地域附近的非遗
3. 适当加入"冷门但有趣"的非遗增加多样性
4. 对于新用户（冷启动），按热度排序推荐

每次推荐 5-8 个项目，每个项目附上 1-2 句推荐理由。"""

# ── End of database.py ──
