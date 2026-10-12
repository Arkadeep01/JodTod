# JodTod Mock Data & API Audit Toolkit

Developer-only tooling to (a) audit every backend endpoint and (b) populate a
**non-production** database with a deterministic multi-user dataset so the API
can be exercised end to end.

Nothing here is imported by the running application or its tests.

## Contents

| File | Purpose |
|------|---------|
| `endpoint_inventory.json` / `.md` | Full endpoint inventory (64 endpoints) with auth, request/response models, and success/error codes. |
| `endpoint_verification_checklist.md` | Executable, evidence-based PASS/FAIL/BLOCKED/NOT TESTED checklist. |
| `manifest.json` | Dataset description, deterministic ID scheme, counts, isolation matrix, expected balances. |
| `expected_results.json` | Per-endpoint expected outcomes for the seeded dataset. |
| `fixtures/` | The dataset as JSON (users, groups, expenses, settlements, activities, notifications, preferences, invitations, support, faqs). |
| `requests/` | Copy-paste HTTP request bodies (with `${PLACEHOLDER}`s) for manual checks. |
| `seed_data.py` | Idempotent, guarded seeder. |
| `verify_seed.py` | Read-only integrity + isolation checks (PASS/FAIL/BLOCKED). |
| `cleanup_seed_data.py` | Guarded removal of the seed rows only. |

## Safety rules enforced by the scripts

- **Never seeds a non-local host by default.** `seed_data.py` and
  `cleanup_seed_data.py` refuse any host that is not `localhost` / `127.0.0.1`
  unless `--allow-remote` is passed. Supabase (the shared cloud DB) is never
  touched.
- **Never stores plaintext passwords.** Fixtures carry no passwords; the seeder
  hashes the value of `JODTOD_SEED_PASSWORD` with the project's existing
  `backend.core.security.hash_password` (Argon2id). No default password is
  committed.
- **Idempotent.** Every row id is `uuid5(NAMESPACE_URL, "jodtod-seed:<entity>:<key>")`,
  so re-running updates the same rows instead of duplicating them.
- **No destructive glamour.** Cleanup deletes only the seed groups/users/FAQs
  (dependents cascade).

## Usage (run from repo root `D:\JodTod`)

```powershell
# 1. Point at a throwaway DB and migrate it
$env:DATABASE_URL = "postgresql+asyncpg://postgres@localhost:5432/jodtod_dev"
alembic upgrade head

# 2. Dry-run first (validates fixtures, no DB writes)
python -m backend.devtools.mock_data.seed_data --dry-run

# 3. Seed
$env:JODTOD_SEED_PASSWORD = "choose-a-strong-dev-password"
python -m backend.devtools.mock_data.seed_data

# 4. Verify
python -m backend.devtools.mock_data.verify_seed

# 5. Reset (optional)
python -m backend.devtools.mock_data.cleanup_seed_data --yes
```

The scripts also run when invoked directly
(`python backend/devtools/mock_data/seed_data.py`) thanks to a repo-root
`sys.path` bootstrap.

## Dataset

- **5 users**: `avery@jodtod.test`, `rohan@jodtod.test`, `priya@jodtod.test`
  (active, verified; avery has Google linked, priya has Apple linked),
  `guest@jodtod.test` (pending/unverified), and the local demo admin
  `arkadeep@admin.com` (active/verified, member of `Office Lunch Squad`).
- **5 groups**: `Goa Trip 2026` (avery/rohan/priya), `Flat 12B Rent`
  (avery/rohan), `Mess Food Fund` (rohan/priya), `Hostel Block C (closed)`
  (archived, rohan/priya), and `Office Lunch Squad` (arkadeep=admin/rohan/priya).
- Expenses/splits, 4 settlements (2 paid, 1 pending, 1 rejected), activities,
  notifications, preferences, invitations, support requests, FAQs.
- **Isolation**: avery is deliberately **not** a member of `Mess Food Fund` or
  `Hostel Block C` — use these to prove cross-user scoping.

### Per-user password override

`fixtures/users.json` may set `"password_env": "<ENV_VAR>"` on a user. When
present, the seeder reads that variable instead of the shared
`JODTOD_SEED_PASSWORD` (missing/`<8` chars → refusal, exit 3). `arkadeep` uses
`JODTOD_DEMO_ADMIN_PASSWORD`. The password is never committed.

```powershell
$env:JODTOD_SEED_PASSWORD = "choose-a-strong-dev-password"
$env:JODTOD_DEMO_ADMIN_PASSWORD = "choose-a-strong-demo-password"
```

Login `arkadeep@admin.com` with `JODTOD_DEMO_ADMIN_PASSWORD`; every other seed
email uses `JODTOD_SEED_PASSWORD`.

> **Known blocker:** seeded `@jodtod.test` addresses currently fail
> `POST /api/auth/login` with HTTP 500 because pydantic `EmailStr` rejects the
> reserved `.test` TLD when serialising `AuthenticatedUser`. `arkadeep@admin.com`
> is the only seed account that authenticates through the API.

## Latest run (local Docker Postgres, 2026-10-11)

Executed end to end against a throwaway local database only
(`localhost:55432`, db `jodtod_local`) with `EMAIL_PROVIDER=mock` /
`OTP_PROVIDER=mock`. The shared Supabase instance was **not** touched.

```powershell
$pw = (docker inspect jodtod-postgres-local --format '{{range .Config.Env}}{{println .}}{{end}}' | Where-Object { $_ -like 'POSTGRES_PASSWORD=*' }).Substring(18)
$env:DATABASE_URL  = "postgresql+asyncpg://jodtod_dev:$pw@127.0.0.1:55432/jodtod_local"
$env:JODTOD_SEED_PASSWORD       = "choose-a-strong-dev-password"
$env:JODTOD_DEMO_ADMIN_PASSWORD = "choose-a-strong-demo-password"
alembic upgrade head
python -m backend.devtools.mock_data.seed_data
python -m backend.devtools.mock_data.verify_seed
```

| Check | Result |
|-------|--------|
| `alembic upgrade head` + `seed_data.py` + `verify_seed.py` | PASS (11 PASS / 0 FAIL) |
| `GET /api/health`, `GET /` | PASS (200) |
| `POST /api/auth/login` as `arkadeep@admin.com` | PASS (200; wrong password → 401) |
| EP-001 … EP-064 live run | **37 PASS / 19 FAIL / 8 BLOCKED** (see `endpoint_runtime_results.json`) |

Three pre-existing backend bugs were found (details in
`endpoint_runtime_results.json` → `findings`):

1. `@jodtod.test` mail is rejected by `EmailStr` → every original seed user
   cannot log in (500); signup with a `.test` mail is 422.
2. Notification endpoints 500 (`NotificationItemResponse` ↔ ORM mismatch).
3. Group/expense/settlement/invitation **writes return 200 but roll back** —
   services read before `async with transaction(db)`, which cannot own the
   already-autobegun request session. 9 endpoints silently no-op.

The `findings` list in `endpoint_runtime_results.json` is the machine-readable
record of the run.
