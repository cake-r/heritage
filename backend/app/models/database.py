"""SQLAlchemy 数据库引擎与Session"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL

# SQLite 需要 check_same_thread=False
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

# 启用外键约束 (SQLite默认关闭)
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
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
    import app.models.user  # noqa: F401 (expansion FK 依赖)
    import app.models.passport  # noqa: F401
    import app.models.expansion  # noqa: F401
    import app.models.recommendation  # noqa: F401
    import app.models.cultivation  # noqa: F401
    Base.metadata.create_all(bind=engine)

    # 迁移: 为已有数据库添加新列
    _migrate_add_column("chat_messages", "voice_url", "VARCHAR(500)")
    _migrate_add_column("user_uploads", "region", "VARCHAR(100)")
    _migrate_add_column("user_uploads", "era", "VARCHAR(100)")
    _migrate_add_column("user_uploads", "techniques_json", "TEXT")
    _migrate_add_column("user_uploads", "inheritors_json", "TEXT")
    _migrate_add_column("user_uploads", "cultural_meaning", "TEXT")
    _migrate_add_column("passport_stamps", "progress", "INTEGER DEFAULT 1")


def _migrate_add_column(table: str, column: str, col_type: str):
    """安全添加列 — 仅在列不存在时执行"""
    if "sqlite" not in DATABASE_URL:
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
