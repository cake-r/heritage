"""Alembic 迁移环境 — 双引擎支持 (SQLite / PostgreSQL)

从 app.config.DATABASE_URL 读取数据库连接，自动发现所有 ORM 模型。
PG 模式使用 JSONB 原生类型；SQLite 模式保持 TEXT + 手动序列化。
"""

import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# 将 backend 项目根目录加入 sys.path，确保 app 包可被导入
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import DATABASE_URL, USE_SQLITE, USE_POSTGRES  # noqa: E402
from app.models.database import Base  # noqa: E402

# 导入所有模型，确保 Base.metadata 包含全部表
import app.models.user  # noqa: E402, F401
import app.models.recognition  # noqa: E402, F401
import app.models.generation  # noqa: E402, F401
import app.models.favorite  # noqa: E402, F401
import app.models.chat  # noqa: E402, F401
import app.models.exhibition  # noqa: E402, F401
import app.models.custom_inheritor  # noqa: E402, F401
import app.models.restoration  # noqa: E402, F401
import app.models.passport  # noqa: E402, F401
import app.models.expansion  # noqa: E402, F401
import app.models.recommendation  # noqa: E402, F401
import app.models.cultivation  # noqa: E402, F401
import app.models.companion  # noqa: E402, F401
import app.models.ai_usage  # noqa: E402, F401
import app.models.async_task  # noqa: E402, F401

# Alembic Config 对象
config = context.config

# 日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 设置目标元数据
target_metadata = Base.metadata

# 将实际 DB URL 注入 Alembic config（覆盖 alembic.ini 中的占位符）
config.set_main_option("sqlalchemy.url", DATABASE_URL)


def run_migrations_offline() -> None:
    """离线模式：生成 SQL 脚本而非直接执行（CI/CD 审计用）"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：直接连接数据库执行迁移"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # SQLite 不支持 ALTER 某些操作，用 batch 模式兼容
            render_as_batch=USE_SQLITE,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
