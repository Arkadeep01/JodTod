"""
Alembic migration environment for JodTod.

Database credentials are loaded through backend.config.
SQLAlchemy metadata is loaded from backend.models.
"""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from backend.config import settings
from backend.models.base import Base

# Import every model so SQLAlchemy metadata contains every table.
from backend.models.activity import Activity
from backend.models.expense import Expense, ExpenseSplit
from backend.models.group import Group, GroupMember
from backend.models.settlement import Settlement
from backend.models.user import User
from backend.models.user_preference import UserPreference
from backend.models.faq import Faq
from backend.models.support_request import SupportRequest
from backend.models.group_invitation import GroupInvitation
from backend.models.notification import Notification
from backend.models.session import Session
from backend.models.otp import OTP
from backend.models.email_verification import EmailVerification
from backend.models.password_reset import PasswordReset


# Alembic Config object.
config = context.config


# Configure Python logging from alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# This is the metadata Alembic uses for autogeneration.
target_metadata = Base.metadata


def get_database_url() -> str:
    """
    Get the database URL from the application's environment-driven
    configuration.

    Alembic receives a synchronous PostgreSQL URL because migration
    execution uses SQLAlchemy's synchronous engine.
    """

    url = settings.database_url.get_secret_value()

    # The application uses asyncpg.
    # Alembic's online migration engine uses psycopg.
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace(
            "postgresql+asyncpg://",
            "postgresql+psycopg://",
            1,
        )

    elif url.startswith("postgresql://"):
        url = url.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1,
        )

    elif url.startswith("postgres://"):
        url = url.replace(
            "postgres://",
            "postgresql+psycopg://",
            1,
        )

    return url


def run_migrations_offline() -> None:
    """
    Run migrations without creating a live database connection.
    """

    url = get_database_url()

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named",
        },
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations using a live database connection.
    """

    configuration = config.get_section(
        config.config_ini_section,
        {},
    )

    configuration["sqlalchemy.url"] = get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()