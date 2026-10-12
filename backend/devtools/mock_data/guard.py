"""Seed-time target safety checks.

Pure, dependency-free guard logic behind the seeder's CLI checks. Kept
separate so the rules ("never seed the shared cloud database", "only
local hosts without opt-in", "abort when the resolved target is not the
one the operator expected") can be unit tested without a database or the
heavy application import graph.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit

# Hosts considered local for the default (no --allow-remote) run.
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}

# Substrings that positively identify the shared hosted database. These
# are refused even when --allow-remote is passed: the shared Supabase /
# pooler instance must never be seeded.
CLOUD_TARGET_MARKERS = ("supabase", "pooler")


@dataclass(frozen=True)
class Target:
    """Non-secret parts of the resolved database URL."""

    host: str
    database: str
    user: str


def parse_target(database_url: str) -> Target:
    """Parse host/database/user out of a SQLAlchemy database URL.

    The password (if any) is intentionally discarded and never included
    in the returned object or any log message.
    """
    normalized = database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    parts = urlsplit(normalized)
    return Target(
        host=parts.hostname or "",
        database=(parts.path or "").lstrip("/"),
        user=parts.username or "",
    )


def is_cloud_target(target: Target) -> bool:
    """True when the target identifies the shared hosted database."""
    haystack = " ".join(
        (target.host, target.database, target.user)
    ).lower()
    return any(marker in haystack for marker in CLOUD_TARGET_MARKERS)


def describe_target(target: Target) -> str:
    """Human-readable target summary with no credentials."""
    return (
        f"host={target.host or '<unset>'} "
        f"db={target.database or '<unset>'} "
        f"user={target.user or '<unset>'}"
    )


def check_seed_target(
    target: Target,
    *,
    allow_remote: bool = False,
    expect_db: str | None = None,
    expect_user: str | None = None,
) -> str | None:
    """Return a refusal reason, or None when seeding may proceed.

    Order of checks matters: the cloud refusal is unconditional, then the
    local-host rule (relaxable with allow_remote), then the positive
    identity assertions the operator opted into.
    """
    if is_cloud_target(target):
        return (
            "target looks like the shared hosted database "
            "(Supabase/pooler); never seed it, even with --allow-remote"
        )
    if target.host not in LOCAL_HOSTS and not allow_remote:
        return (
            f"non-local database host '{target.host}' "
            "(pass --allow-remote to override; never for "
            "production/Supabase)"
        )
    if expect_db and target.database != expect_db:
        return (
            f"database name '{target.database}' does not match "
            f"--expect-db '{expect_db}'"
        )
    if expect_user and target.user != expect_user:
        return (
            f"database user '{target.user}' does not match "
            f"--expect-user '{expect_user}'"
        )
    return None
