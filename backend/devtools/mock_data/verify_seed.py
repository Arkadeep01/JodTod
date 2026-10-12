"""
Verify the JodTod mock dataset after seeding.

Runs read-only integrity + multi-user isolation checks against the configured
database and prints PASS/FAIL per check. If the database is unreachable the
result is BLOCKED (never reported as PASS/FAIL).

Usage (repo root):
    python -m backend.devtools.mock_data.verify_seed

Exit codes: 0 all checks pass, 1 at least one FAIL, 4 BLOCKED (DB unreachable).
"""

from __future__ import annotations

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import func, select  # noqa: E402

from backend.database import (  # noqa: E402
    AsyncSessionLocal,
    check_database_connection,
    dispose_database,
)
from backend.models.activity import Activity  # noqa: E402
from backend.models.expense import Expense, ExpenseSplit  # noqa: E402
from backend.models.group import Group, GroupMember  # noqa: E402
from backend.models.notification import Notification  # noqa: E402
from backend.models.settlement import (  # noqa: E402
    Settlement,
    SettlementStatus,
)
from backend.models.user import User  # noqa: E402
from backend.models.user_preference import UserPreference  # noqa: E402

RESULTS: list[tuple[str, str, str]] = []


def record(status: str, name: str, detail: str = "") -> None:
    RESULTS.append((status, name, detail))
    print(f"[{status}] {name}" + (f" - {detail}" if detail else ""))


async def count(db, model, *where) -> int:
    stmt = select(func.count()).select_from(model)
    for clause in where:
        stmt = stmt.where(clause)
    return int(await db.scalar(stmt) or 0)


async def run() -> int:
    try:
        await check_database_connection()
    except Exception as exc:  # noqa: BLE001
        record("BLOCKED", "database reachable", f"{type(exc).__name__}: {exc}")
        return 4

    async with AsyncSessionLocal() as db:
        # ---- users ----
        emails = [
            "avery@jodtod.test",
            "rohan@jodtod.test",
            "priya@jodtod.test",
            "guest@jodtod.test",
        ]
        users = {
            e: await db.scalar(select(User).where(User.email == e))
            for e in emails
        }
        missing = [e for e, u in users.items() if u is None]
        if missing:
            record("FAIL", "all seed users present", f"missing: {missing}")
            return 1
        record("PASS", "all seed users present")

        # password hashing (never plaintext)
        if all(
            u.password_hash and u.password_hash.startswith("$argon2")
            for u in users.values()
        ):
            record("PASS", "passwords stored as argon2 hashes")
        else:
            record("FAIL", "passwords stored as argon2 hashes")

        avery = users["avery@jodtod.test"]
        rohan = users["rohan@jodtod.test"]
        priya = users["priya@jodtod.test"]
        guest = users["guest@jodtod.test"]

        # ---- groups + membership ----
        grp = {}
        for code, key in [
            ("GOA2026SEED", "goa"),
            ("FLAT12BSEED", "flat"),
            ("MESSFUND01", "mess"),
            ("HOSTELOLD1", "hostel"),
        ]:
            grp[key] = await db.scalar(
                select(Group).where(Group.invite_code == code)
            )
        if all(grp.values()):
            record("PASS", "all seed groups present")
        else:
            record(
                "FAIL",
                "all seed groups present",
                f"missing: {[k for k, g in grp.items() if g is None]}",
            )

        goa_members = await count(
            db, GroupMember, GroupMember.group_id == grp["goa"].id
        )
        if goa_members == 3:
            record("PASS", "goa_trip has 3 members")
        else:
            record("FAIL", "goa_trip has 3 members", f"got {goa_members}")

        # ---- isolation: avery is NOT in food_mess ----
        avery_in_mess = await count(
            db,
            GroupMember,
            GroupMember.group_id == grp["mess"].id,
            GroupMember.user_id == avery.id,
        )
        if avery_in_mess == 0:
            record("PASS", "isolation: avery not a member of food_mess")
        else:
            record("FAIL", "isolation: avery not a member of food_mess")

        # ---- expense split integrity: sum(shares) == amount ----
        expenses = (
            await db.execute(select(Expense).where(Expense.amount > 0))
        ).scalars().all()
        bad_splits = []
        for expense in expenses:
            if expense.title not in {
                "Beach shack dinner",
                "Scooter rental",
                "February rent",
                "Electricity + water",
                "Groceries",
            }:
                continue
            total = await db.scalar(
                select(func.coalesce(func.sum(ExpenseSplit.share_amount), 0))
                .where(ExpenseSplit.expense_id == expense.id)
            )
            if Decimal(total) != Decimal(expense.amount):
                bad_splits.append((expense.title, str(total), str(expense.amount)))
        if not bad_splits:
            record("PASS", "expense splits sum to expense amount")
        else:
            record("FAIL", "expense splits sum to expense amount", str(bad_splits))

        # ---- settlements ----
        paid = await count(
            db,
            Settlement,
            Settlement.status == SettlementStatus.PAID,
        )
        pending = await count(
            db,
            Settlement,
            Settlement.status == SettlementStatus.PENDING,
        )
        rejected = await count(
            db,
            Settlement,
            Settlement.status == SettlementStatus.REJECTED,
        )
        ok = paid == 2 and pending == 1 and rejected == 1
        record(
            "PASS" if ok else "FAIL",
            "settlement statuses (2 paid / 1 pending / 1 rejected)",
            f"paid={paid} pending={pending} rejected={rejected}",
        )

        # avery is receiver of the pending settlement (pending-confirmations inbox)
        avery_pending = await count(
            db,
            Settlement,
            Settlement.receiver_user_id == avery.id,
            Settlement.status == SettlementStatus.PENDING,
        )
        record(
            "PASS" if avery_pending == 1 else "FAIL",
            "avery has 1 pending confirmation",
            f"got {avery_pending}",
        )

        # ---- activities per user (user-scoped) ----
        a_act = await count(db, Activity, Activity.user_id == avery.id)
        r_act = await count(db, Activity, Activity.user_id == rohan.id)
        p_act = await count(db, Activity, Activity.user_id == priya.id)
        g_act = await count(db, Activity, Activity.user_id == guest.id)
        ok = (a_act, r_act, p_act, g_act) == (4, 4, 3, 0)
        record(
            "PASS" if ok else "FAIL",
            "activity counts per user (4/4/3/0)",
            f"avery={a_act} rohan={r_act} priya={p_act} guest={g_act}",
        )

        # ---- notifications per user + unread ----
        def unread_clause(uid):
            return (Notification.recipient_user_id == uid) & (
                Notification.read_at.is_(None)
            )

        a_unread = await count(db, Notification, unread_clause(avery.id))
        r_unread = await count(db, Notification, unread_clause(rohan.id))
        p_unread = await count(db, Notification, unread_clause(priya.id))
        ok = (a_unread, r_unread, p_unread) == (2, 1, 2)
        record(
            "PASS" if ok else "FAIL",
            "unread notification counts (2/1/2)",
            f"avery={a_unread} rohan={r_unread} priya={p_unread}",
        )

        # ---- preferences ----
        a_pref = await db.scalar(
            select(UserPreference).where(UserPreference.user_id == avery.id)
        )
        p_pref = await db.scalar(
            select(UserPreference).where(UserPreference.user_id == priya.id)
        )
        ok = bool(
            a_pref
            and a_pref.display_name == "username"
            and p_pref
            and p_pref.date_format == "YYYY-MM-DD"
        )
        record("PASS" if ok else "FAIL", "seed preferences match fixtures")

    await dispose_database()
    fails = [r for r in RESULTS if r[0] == "FAIL"]
    blocked = [r for r in RESULTS if r[0] == "BLOCKED"]
    print(
        f"\nSummary: {len(RESULTS) - len(fails) - len(blocked)} PASS, "
        f"{len(fails)} FAIL, {len(blocked)} BLOCKED"
    )
    if blocked:
        return 4
    return 1 if fails else 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(run()))
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        print(f"[BLOCKED] verify_seed crashed: {type(exc).__name__}: {exc}")
        raise SystemExit(4)
