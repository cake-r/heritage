#!/usr/bin/env python3
"""
SQLite → PostgreSQL 数据迁移脚本

用法:
    python scripts/migrate_sqlite_to_pg.py

环境变量:
    SOURCE_DB_URL — SQLite 源数据库 URL (默认: config.DATABASE_URL 即 SQLite)
    TARGET_DB_URL — PostgreSQL 目标数据库 URL (必须提供)

迁移策略: 纯复制 (SQLite 文件不会被修改)
    1. 从 SQLite 按 FK 依赖顺序读取全部行
    2. 写入 PostgreSQL (使用独立 Session)
    3. 验证每张表的行数一致
    4. 重置 PostgreSQL 序列
"""

import os
import sys
from pathlib import Path

# 确保 backend 在 sys.path 中
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

from app.config import BASE_DIR  # noqa: E402


# --- 配置 ---
SOURCE_URL = os.getenv("SOURCE_DB_URL") or os.getenv("DATABASE_URL")
TARGET_URL = os.getenv("TARGET_DB_URL")

# 19 张表，按 FK 依赖顺序排列 (被引用表在前, 引用表在后)
TABLE_ORDER = [
    "users",
    "user_settings",
    "user_interest_profile",
    "user_cultivation",
    "user_quests",
    "companion_interactions",
    "heritage_items",
    "user_uploads",
    "favorites",
    "recognition_records",
    "generated_works",
    "chat_sessions",
    "chat_messages",
    "custom_inheritors",
    "restoration_records",
    "passport_stamps",
    "expansion_queue",
    "ai_usage_logs",
    "async_tasks",
]

# 自动当 ID 列的表 (PG 序列需重置)
SEQUENCE_TABLES = [
    "users",
    "heritage_items",
    "recognition_records",
    "generated_works",
    "chat_sessions",
    "chat_messages",
    "custom_inheritors",
    "restoration_records",
    "passport_stamps",
    "favorites",
    "user_uploads",
    "expansion_queue",
    "user_quests",
    "companion_interactions",
    "ai_usage_logs",
    "async_tasks",
]


def get_engine(db_url: str):
    """根据 URL 创建引擎"""
    connect_args = {}
    if "sqlite" in db_url:
        connect_args = {"check_same_thread": False}
    return create_engine(db_url, connect_args=connect_args, echo=False)


def migrate():
    if not TARGET_URL:
        print("错误: 请设置 TARGET_DB_URL 环境变量指向 PostgreSQL 数据库")
        print("示例: TARGET_DB_URL=postgresql://postgres:pass@localhost:5432/ich_platform")
        sys.exit(1)

    if "postgresql" not in TARGET_URL:
        print("错误: TARGET_DB_URL 必须是 PostgreSQL 连接字符串")
        sys.exit(1)

    print(f"源数据库 (SQLite): {SOURCE_URL}")
    print(f"目标数据库 (PG):   {TARGET_URL}")
    print("-" * 60)

    src_engine = get_engine(SOURCE_URL)
    tgt_engine = get_engine(TARGET_URL)
    SrcSession = sessionmaker(bind=src_engine)
    TgtSession = sessionmaker(bind=tgt_engine)

    # 确保目标数据库中表已存在 (通过 Alembic 或 create_all)
    from app.models.database import Base, init_db as _unused  # noqa: F401
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

    print("在目标 PostgreSQL 中创建表结构 ...")
    Base.metadata.create_all(bind=tgt_engine)
    print("表结构创建完成\n")

    inspector = inspect(src_engine)
    src_tables = set(inspector.get_table_names())

    total_rows_migrated = 0
    skipped_tables = []

    for table_name in TABLE_ORDER:
        if table_name not in src_tables:
            skipped_tables.append(table_name)
            continue

        src_session = SrcSession()
        tgt_session = TgtSession()

        try:
            # 读取源数据
            result = src_session.execute(text(f"SELECT * FROM {table_name}"))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]

            if not rows:
                print(f"  {table_name}: 0 行 (空表, 跳过)")
                continue

            # 写入目标 (逐行 insert，避免 bulk 映射问题)
            for row in rows:
                placeholders = ", ".join([f":{col}" for col in columns])
                col_names = ", ".join(columns)
                tgt_session.execute(
                    text(f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})"),
                    row,
                )

            tgt_session.commit()
            print(f"  {table_name}: {len(rows)} 行 ✓")
            total_rows_migrated += len(rows)

        except Exception as e:
            tgt_session.rollback()
            print(f"  {table_name}: 错误 — {e}")
            raise
        finally:
            src_session.close()
            tgt_session.close()

    print("-" * 60)
    print(f"迁移完成: {total_rows_migrated} 行 从 SQLite → PostgreSQL")

    if skipped_tables:
        print(f"跳过的表 (源库中不存在): {', '.join(skipped_tables)}")

    # 重置 PostgreSQL 序列
    print("\n重置 PostgreSQL 序列 ...")
    tgt_session = TgtSession()
    try:
        for table in SEQUENCE_TABLES:
            if table in src_tables:
                try:
                    tgt_session.execute(text(
                        f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                        f"COALESCE((SELECT MAX(id) FROM {table}), 1))"
                    ))
                except Exception:
                    pass  # 该表可能没有 serial id 列
        tgt_session.commit()
        print("序列重置完成")
    finally:
        tgt_session.close()

    # 验证行数
    print("\n验证行数 ...")
    src_session = SrcSession()
    tgt_session = TgtSession()
    all_match = True
    try:
        for table_name in TABLE_ORDER:
            if table_name not in src_tables:
                continue
            src_count = src_session.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
            tgt_count = tgt_session.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
            status = "✓" if src_count == tgt_count else "✗ 不匹配!"
            if src_count != tgt_count:
                all_match = False
            print(f"  {table_name}: SQLite={src_count}, PG={tgt_count} {status}")
    finally:
        src_session.close()
        tgt_session.close()

    if all_match:
        print("\n✓ 所有表行数一致, 迁移成功!")
    else:
        print("\n✗ 部分表行数不一致, 请检查")
        sys.exit(1)


if __name__ == "__main__":
    migrate()
