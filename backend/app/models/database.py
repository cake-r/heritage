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

    # 自动种子数据: 确保数据库重建后非遗展厅数据不丢失
    _seed_heritage_if_empty()

    # 自动种子纹样基因库
    _seed_pattern_genes_if_empty()

    # 增量迁移: 已有数据的库也需要新增纹样
    _migrate_pattern_genes()


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
