"""
JodTod mock-data seeder (idempotent, guarded).

Purpose
-------
Populate a LOCAL/DEV/TEST Postgres database with a deterministic multi-user
dataset so the whole API surface can be exercised manually (see
endpoint_verification_checklist.md).

Safety
------
* Refuses to run against any non-local database host unless --allow-remote is
  passed. Supabase (the shared cloud DB) is therefore never touched by default.
* Never writes plaintext passwords to the DB: it hashes them with the project's
  existing Argon2id helper (backend.core.security.hash_password).
* Never stores plaintext passwords in files: the password comes from the
  JODTOD_SEED_PASSWORD environment variable (or --password).
* Idempotent: every row has a deterministic UUID derived from a logical key
  (uuid5), so re-running updates the same rows instead of duplicating them.

Usage
-----
    # from repo root D:\\JodTod
    $env:JODTOD_SEED_PASSWORD = "choose-a-strong-dev-password"
    python -m backend.devtools.mock_data.seed_data            # normal run
    python -m backend.devtools.mock_data.seed_data --dry-run   # validate, no DB
    python -m backend.devtools.mock_data.seed_data --allow-remote  # opt-in remote

Exit codes: 0 ok, 2 safety refusal, 3 missing password, 4 database error.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# ---------------------------------------------------------------------------
# Repo-root bootstrap so `backend.*` imports resolve when the file is run
# directly (python backend/devtools/mock_data/seed_data.py). Standard for
# standalone devtools; not a change to the app's import architecture.
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import select  # noqa: E402

from backend.config import settings  # noqa: E402
from backend.core.security import hash_password  # noqa: E402
from backend.database import AsyncSessionLocal, dispose_database  # noqa: E402
from backend.devtools.mock_data.guard import (  # noqa: E402
    check_seed_target,
    describe_target,
    parse_target,
)
from backend.models.activity import Activity, ActivityType  # noqa: E402
from backend.models.expense import Expense, ExpenseSplit  # noqa: E402
from backend.models.faq import Faq  # noqa: E402
from backend.models.group import (  # noqa: E402
    Group,
    GroupLifecycle,
    GroupMember,
    GroupType,
    MemberRole,
)
from backend.models.group_invitation import GroupInvitation  # noqa: E402
from backend.models.notification import (  # noqa: E402
    Notification,
    NotificationType,
)
from backend.models.settlement import (  # noqa: E402
    PaymentMethod,
    Settlement,
    SettlementStatus,
)
from backend.models.support_request import SupportRequest  # noqa: E402
from backend.models.user import AccountStatus, User  # noqa: E402
from backend.models.user_preference import UserPreference  # noqa: E402

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
SEED_NS = uuid.NAMESPACE_URL


def sid(entity: str, key: str) -> uuid.UUID:
    """Deterministic seed UUID for a logical entity:key pair."""
    return uuid.uuid5(SEED_NS, f"jodtod-seed:{entity}:{key}")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def load_fixture(name: str) -> list[dict]:
    path = FIXTURES_DIR / name
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed the JodTod dev/test database with mock data."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate fixtures and print the plan without touching the DB.",
    )
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Permit running against a non-local DB host (required opt-in).",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="Seed password. Prefer the JODTOD_SEED_PASSWORD env var.",
    )
    parser.add_argument(
        "--expect-db",
        default=None,
        help=(
            "Refuse to write unless the resolved database name matches "
            "this value (e.g. jodtod_local). Positive local-target check."
        ),
    )
    parser.add_argument(
        "--expect-user",
        default=None,
        help=(
            "Refuse to write unless the resolved database user matches "
            "this value (e.g. jodtod_dev). Positive local-target check."
        ),
    )
    return parser.parse_args(argv)


def resolve_password(args: argparse.Namespace) -> str | None:
    password = args.password or os.environ.get("JODTOD_SEED_PASSWORD")
    if password and len(password) < 8:
        print("Refusing: seed password must be at least 8 characters.")
        return None
    return password


def resolve_user_password(row: dict, default_password: str) -> str:
    """Password for one fixture user.

    Users without a `password_env` key share the default
    JODTOD_SEED_PASSWORD (existing behaviour, unchanged). A user may name
    its own env var via `password_env` (e.g. the Arkadeep demo account),
    so a distinct local demo password can be supplied without committing
    any plaintext credential to the fixture. Missing/short override
    values abort before any database write.
    """
    env_name = row.get("password_env")
    if not env_name:
        return default_password
    value = os.environ.get(env_name)
    if not value or len(value) < 8:
        print(
            f"Refusing: seed user '{row.get('key')}' requires password "
            f"env var '{env_name}' with at least 8 characters. No default "
            "is committed."
        )
        raise SystemExit(3)
    return value


# ---------------------------------------------------------------------------
# Generic idempotent upsert
# ---------------------------------------------------------------------------
async def upsert(
    db,
    model,
    row_id: uuid.UUID,
    values: dict,
    lookup=None,
):
    obj = None
    if lookup is not None:
        obj = await db.scalar(select(model).where(lookup))
    if obj is None:
        obj = await db.get(model, row_id)
    if obj is None:
        obj = model(id=row_id, **values)
        db.add(obj)
    else:
        for key, value in values.items():
            setattr(obj, key, value)
    await db.flush()
    return obj


# ---------------------------------------------------------------------------
# Seed steps (each returns counts for the summary)
# ---------------------------------------------------------------------------
async def seed_users(db, rows, passwords: dict[str, str]) -> dict:
    ids: dict[str, uuid.UUID] = {}
    for row in rows:
        email = row["email"]
        phone = row["phone"]
        lookup = (
            (User.email == email)
            | (User.phone == phone)
            | (User.username == row["username"])
        )
        values = {
            "name": row["name"],
            "username": row["username"],
            "email": email,
            "phone": phone,
            "password_hash": hash_password(passwords[row["key"]]),
            "email_verified": row["email_verified"],
            "phone_verified": row["phone_verified"],
            "account_status": AccountStatus(row["account_status"]),
            "is_active": True,
            "google_subject": row.get("google_subject"),
            "google_email": row.get("google_email"),
            "apple_subject": row.get("apple_subject"),
            "apple_email": row.get("apple_email"),
            "google_linked_at": (
                utc_now() if row.get("google_subject") else None
            ),
            "apple_linked_at": (
                utc_now() if row.get("apple_subject") else None
            ),
            "avatar_url": row.get("avatar_url"),
        }
        obj = await upsert(db, User, sid("user", row["key"]), values, lookup)
        ids[row["key"]] = obj.id
    return ids


async def seed_groups(db, rows, user_ids) -> dict:
    ids: dict[str, uuid.UUID] = {}
    for row in rows:
        lookup = (
            (Group.invite_code == row["invite_code"])
            | (Group.name == row["name"])
        )
        values = {
            "name": row["name"],
            "description": row.get("description"),
            "group_type": GroupType(row["group_type"]),
            "currency": row["currency"],
            "image_url": row.get("image_url"),
            "lifecycle": GroupLifecycle(row["lifecycle"]),
            "invite_code": row["invite_code"],
            "created_by": user_ids[row["created_by"]],
        }
        group = await upsert(db, Group, sid("group", row["key"]), values, lookup)
        ids[row["key"]] = group.id
        for member in row["members"]:
            member_key = f"{row['key']}:{member['user']}"
            await upsert(
                db,
                GroupMember,
                sid("group_member", member_key),
                {
                    "group_id": group.id,
                    "user_id": user_ids[member["user"]],
                    "role": MemberRole(member["role"]),
                },
            )
    return ids


async def seed_expenses(db, rows, group_ids, user_ids) -> int:
    count = 0
    for row in rows:
        when = utc_now() + timedelta(days=row["expense_date_offset_days"])
        group_id = group_ids[row["group"]]
        expense = await upsert(
            db,
            Expense,
            sid("expense", row["key"]),
            {
                "group_id": group_id,
                "title": row["title"],
                "description": row.get("description"),
                "amount": Decimal(row["amount"]),
                "currency": row["currency"],
                "payer_user_id": user_ids[row["payer"]],
                "expense_date": when,
                "created_by": user_ids[row["payer"]],
            },
        )
        for split in row["splits"]:
            await upsert(
                db,
                ExpenseSplit,
                sid("expense_split", f"{row['key']}:{split['user']}"),
                {
                    "expense_id": expense.id,
                    "user_id": user_ids[split["user"]],
                    "share_amount": Decimal(split["share"]),
                },
            )
        count += 1
    return count


async def seed_settlements(db, rows, group_ids, user_ids) -> int:
    for row in rows:
        initiated = utc_now() + timedelta(days=row["initiated_at_offset_days"])
        confirmed = (
            utc_now() + timedelta(days=row["confirmed_at_offset_days"])
            if row.get("confirmed_at_offset_days") is not None
            else None
        )
        await upsert(
            db,
            Settlement,
            sid("settlement", row["key"]),
            {
                "group_id": group_ids[row["group"]],
                "payer_user_id": user_ids[row["payer"]],
                "receiver_user_id": user_ids[row["receiver"]],
                "amount": Decimal(row["amount"]),
                "currency": row["currency"],
                "status": SettlementStatus(row["status"]),
                "payment_method": PaymentMethod(row["payment_method"]),
                "note": row.get("note"),
                "idempotency_key": row["idempotency_key"],
                "initiated_at": initiated,
                "confirmed_at": confirmed,
                "rejection_reason": row.get("rejection_reason"),
            },
        )
    return len(rows)


async def seed_activities(db, rows, user_ids) -> int:
    for row in rows:
        occurred = utc_now() + timedelta(
            hours=row["occurred_at_offset_hours"]
        )
        await upsert(
            db,
            Activity,
            sid("activity", f"{row['user']}:{row['title']}"),
            {
                "user_id": user_ids[row["user"]],
                "type": ActivityType(row["type"]),
                "title": row["title"],
                "subtitle": row.get("subtitle"),
                "amount": row.get("amount"),
                "occurred_at": occurred,
                "member_key": row.get("member_key"),
                "group_name": row.get("group_name"),
                "actor_name": row.get("actor_name"),
                "actor_avatar": row.get("actor_avatar"),
                "counterparty_name": row.get("counterparty_name"),
                "counterparty_avatar": row.get("counterparty_avatar"),
                "counterparty_sub": row.get("counterparty_sub"),
                "category": row.get("category"),
                "status": row.get("status"),
                "description": row.get("description"),
                "split_type": row.get("split_type"),
                "split_among": row.get("split_among"),
                "each_share": row.get("each_share"),
                "bill_image": row.get("bill_image"),
                "participants": row.get("participants"),
            },
        )
    return len(rows)


async def seed_notifications(
    db, rows, user_ids, group_ids, expense_ids, settlement_ids
) -> int:
    for row in rows:
        created = utc_now() + timedelta(
            hours=row["created_at_offset_hours"]
        )
        read_at = (
            utc_now() + timedelta(hours=row["read_at_offset_hours"])
            if row.get("read_at_offset_hours") is not None
            else None
        )
        related_group = row.get("related_group")
        related_expense = row.get("related_expense")
        related_settlement = row.get("related_settlement")
        related_user = row.get("related_user")
        await upsert(
            db,
            Notification,
            sid(
                "notification",
                f"{row['recipient']}:{row['notification_type']}:"
                f"{row['title']}",
            ),
            {
                "recipient_user_id": user_ids[row["recipient"]],
                "notification_type": NotificationType(row["notification_type"]),
                "title": row["title"],
                "message": row["message"],
                "related_group_id": (
                    group_ids.get(related_group) if related_group else None
                ),
                "related_expense_id": (
                    expense_ids.get(related_expense)
                    if related_expense
                    else None
                ),
                "related_settlement_id": (
                    settlement_ids.get(related_settlement)
                    if related_settlement
                    else None
                ),
                "related_user_id": (
                    user_ids.get(related_user) if related_user else None
                ),
                "attachment_reference": row.get("attachment_reference"),
                "context_data": row.get("context_data"),
                "read_at": read_at,
                "created_at": created,
            },
        )
    return len(rows)


async def seed_preferences(db, rows, user_ids) -> int:
    for row in rows:
        await upsert(
            db,
            UserPreference,
            sid("preference", row["user"]),
            {
                "user_id": user_ids[row["user"]],
                "currency": row["currency"],
                "date_format": row["date_format"],
                "start_of_week": row["start_of_week"],
                "app_language": row["app_language"],
                "display_name": row["display_name"],
            },
        )
    return len(rows)


async def seed_invitations(db, rows, user_ids) -> int:
    for row in rows:
        await upsert(
            db,
            GroupInvitation,
            sid("invitation", f"{row['invitee']}:{row['group_name']}"),
            {
                "user_id": user_ids[row["invitee"]],
                "group_name": row["group_name"],
                "invite_code": row["invite_code"],
                "invited_by": row.get("invited_by"),
                "status": row["status"],
            },
        )
    return len(rows)


async def seed_support(db, rows, user_ids) -> int:
    for row in rows:
        await upsert(
            db,
            SupportRequest,
            sid("support", f"{row['user']}:{row['subject']}"),
            {
                "user_id": user_ids[row["user"]],
                "type": row["type"],
                "subject": row["subject"],
                "description": row["description"],
                "app_version": row.get("app_version"),
                "screen": row.get("screen"),
                "status": row["status"],
            },
        )
    return len(rows)


async def seed_faqs(db, rows) -> int:
    for row in rows:
        await upsert(
            db,
            Faq,
            sid("faq", row["question"]),
            {
                "question": row["question"],
                "answer": row["answer"],
                "category": row["category"],
                "display_order": row["display_order"],
                "is_active": row["is_active"],
            },
        )
    return len(rows)


async def run(dry_run: bool) -> dict:
    users = load_fixture("users.json")
    groups = load_fixture("groups.json")
    expenses = load_fixture("expenses.json")
    settlements = load_fixture("settlements.json")
    activities = load_fixture("activities.json")
    notifications = load_fixture("notifications.json")
    preferences = load_fixture("preferences.json")
    invitations = load_fixture("invitations.json")
    support = load_fixture("support_requests.json")
    faqs = load_fixture("faqs.json")

    if dry_run:
        return {
            "dry_run": True,
            "users": len(users),
            "groups": len(groups),
            "expenses": len(expenses),
            "settlements": len(settlements),
            "activities": len(activities),
            "notifications": len(notifications),
            "preferences": len(preferences),
            "invitations": len(invitations),
            "support_requests": len(support),
            "faqs": len(faqs),
        }

    password = resolve_password(ARGS)
    if not password:
        raise SystemExit(3)

    # Resolve every per-user password BEFORE touching the database so a
    # missing override env var aborts cleanly with no partial writes.
    user_passwords = {
        row["key"]: resolve_user_password(row, password) for row in users
    }

    async with AsyncSessionLocal() as db:
        async with db.begin():
            user_ids = await seed_users(db, users, user_passwords)
            group_ids = await seed_groups(db, groups, user_ids)
            n_exp = await seed_expenses(db, expenses, group_ids, user_ids)
            expense_ids = {row["key"]: sid("expense", row["key"]) for row in expenses}
            settlement_ids = {
                row["key"]: sid("settlement", row["key"]) for row in settlements
            }
            n_set = await seed_settlements(
                db, settlements, group_ids, user_ids
            )
            n_act = await seed_activities(db, activities, user_ids)
            n_notif = await seed_notifications(
                db,
                notifications,
                user_ids,
                group_ids,
                expense_ids,
                settlement_ids,
            )
            n_pref = await seed_preferences(db, preferences, user_ids)
            n_inv = await seed_invitations(db, invitations, user_ids)
            n_sup = await seed_support(db, support, user_ids)
            n_faq = await seed_faqs(db, faqs)

    return {
        "dry_run": False,
        "users": len(user_ids),
        "groups": len(group_ids),
        "expenses": n_exp,
        "settlements": n_set,
        "activities": n_act,
        "notifications": n_notif,
        "preferences": n_pref,
        "invitations": n_inv,
        "support_requests": n_sup,
        "faqs": n_faq,
        "user_ids": {k: str(v) for k, v in user_ids.items()},
        "group_ids": {k: str(v) for k, v in group_ids.items()},
    }


ARGS = argparse.Namespace()


async def seed_and_dispose(dry_run: bool) -> dict:
    """Run the seed and dispose the engine inside ONE event loop.

    Disposing in a second asyncio.run() closes asyncpg connections on a
    different loop than the one that created them, which raises on
    Windows. Keeping both operations in the same loop avoids that.
    """
    try:
        return await run(dry_run)
    finally:
        await dispose_database()


def main(argv: list[str]) -> int:
    global ARGS
    ARGS = parse_args(argv)

    target = parse_target(settings.database_url.get_secret_value())
    print(f"Target database: {describe_target(target)}")

    refusal = None
    if not ARGS.dry_run:
        refusal = check_seed_target(
            target,
            allow_remote=ARGS.allow_remote,
            expect_db=ARGS.expect_db,
            expect_user=ARGS.expect_user,
        )
    if refusal:
        print(f"Refusing to seed: {refusal}.")
        return 2

    if not ARGS.dry_run and not resolve_password(ARGS):
        print(
            "Missing seed password. Set JODTOD_SEED_PASSWORD or pass "
            "--password (min 8 chars). No default is committed."
        )
        return 3

    try:
        summary = asyncio.run(seed_and_dispose(ARGS.dry_run))
    except SystemExit as exc:
        return int(exc.code or 0)
    except Exception as exc:  # noqa: BLE001 - report and fail cleanly
        print(f"Seed failed: {type(exc).__name__}: {exc}")
        return 4

    print(json.dumps(summary, indent=2))
    if summary.get("dry_run"):
        print("DRY RUN complete: fixtures valid, no database writes performed.")
    else:
        print("Seed complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
