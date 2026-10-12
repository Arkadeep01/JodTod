"""
Remove ONLY the JodTod mock dataset created by seed_data.py (guarded).

Deletion strategy:
  1. Delete seed groups by their fixture invite codes (cascades members,
     expenses + splits, settlements).
  2. Delete seed users by their fixture emails (cascades sessions, activities,
     notifications, preferences, invitations, support requests, OTP rows).
  3. Delete seed FAQs by their fixture questions.

Safety:
  * Refuses to run against a non-local host unless --allow-remote is passed.
  * Requires an explicit --yes flag before deleting anything.

Usage (repo root):
    python -m backend.devtools.mock_data.cleanup_seed_data --yes

Exit codes: 0 ok, 2 safety refusal, 4 database error.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import delete, select  # noqa: E402

from backend.config import settings  # noqa: E402
from backend.database import AsyncSessionLocal, dispose_database  # noqa: E402
from backend.models.faq import Faq  # noqa: E402
from backend.models.group import Group  # noqa: E402
from backend.models.user import User  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "host.docker.internal"}


def load(name: str) -> list[dict]:
    with (FIXTURES_DIR / name).open(encoding="utf-8") as handle:
        return json.load(handle)


def host() -> str:
    return urlsplit(
        settings.database_url.get_secret_value().replace(
            "postgresql+asyncpg://", "postgresql://"
        )
    ).hostname or ""


async def run() -> int:
    emails = [row["email"] for row in load("users.json")]
    invite_codes = [row["invite_code"] for row in load("groups.json")]
    questions = [row["question"] for row in load("faqs.json")]

    async with AsyncSessionLocal() as db:
        async with db.begin():
            groups = (
                await db.execute(
                    select(Group).where(Group.invite_code.in_(invite_codes))
                )
            ).scalars().all()
            for group in groups:
                await db.delete(group)

            users = (
                await db.execute(select(User).where(User.email.in_(emails)))
            ).scalars().all()
            for user in users:
                await db.delete(user)

            await db.execute(delete(Faq).where(Faq.question.in_(questions)))

        print(
            f"Deleted {len(groups)} groups, {len(users)} users, "
            f"{len(questions)} faqs (seed rows only)."
        )
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Remove the mock dataset.")
    parser.add_argument("--yes", action="store_true", help="Confirm deletion.")
    parser.add_argument("--allow-remote", action="store_true")
    args = parser.parse_args(argv)

    current_host = host()
    print(f"Target database host: {current_host or '<unset>'}")

    if current_host not in LOCAL_HOSTS and not args.allow_remote:
        print("Refusing non-local host without --allow-remote.")
        return 2
    if not args.yes:
        print("Refusing to delete without --yes.")
        return 2

    try:
        code = asyncio.run(run())
    except Exception as exc:  # noqa: BLE001
        print(f"Cleanup failed: {type(exc).__name__}: {exc}")
        code = 4
    finally:
        try:
            asyncio.run(dispose_database())
        except Exception:  # noqa: BLE001
            pass
    return code


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
