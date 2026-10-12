# JodTod

FastAPI backend (SQLAlchemy + Alembic + Supabase PostgreSQL) and a React Native / Expo mobile app.

This README covers two things: **what is implemented in the backend** and **which terminal commands to run, when, and why** on Windows and macOS.

---

## 1. What is implemented in the backend

| Area                                 | File                                                                                 | Status |
| ------------------------------------ | ------------------------------------------------------------------------------------ | ------ |
| Configuration (reads `backend/.env`) | `backend/config.py`                                                                  | Done   |
| Database engine + connection check   | `backend/database.py`                                                                | Done   |
| SQLAlchemy models                    | `backend/models/` (`user`, `session`, `otp`, `email_verification`, `password_reset`) | Done   |
| Alembic migrations                   | `alembic.ini`, `backend/alembic/`                                                    | Done   |
| Initial migration `55fd1c0613a9`     | Creates the 5 tables below                                                           | Done   |
| FastAPI app + `GET /health`          | `backend/main.py`                                                                    | Done   |

**Database tables created by the initial migration**

| Table                 | Purpose                                                                              |
| --------------------- | ------------------------------------------------------------------------------------ |
| `users`               | Account identity (email, phone, password hash, verification flags, Google/Apple IDs) |
| `sessions`            | Refresh-token sessions per device (stores token hash only)                           |
| `otp_records`         | OTP lifecycle (hash, expiry, attempts, lock)                                         |
| `email_verifications` | Email verification token hashes                                                      |
| `password_resets`     | Password reset token hashes                                                          |

**Not implemented yet:** schemas, password/OTP hashing, JWT, services, auth middleware/dependencies, auth routes, user routes, and the mobile auth layer.

---

## 2. Golden rule

**Run every backend command from the repository root** (the folder that contains `backend/`, `mobile/`, and `alembic.ini`), not from inside `backend/`.

Why: the code imports `from backend.config import settings`, which only works when the repo root is on the Python path.

---

## 3. First-time setup (once, after cloning)

### Step 1: Clone and open the repo root

**When:** you are setting up for the first time.
**Why:** everything else runs from here.

Windows (PowerShell) and macOS (Terminal):

```bash
git clone <REPOSITORY_URL>
cd JodTod
```

### Step 2: Create the virtual environment

**When:** once per machine.
**Why:** keeps the project's Python packages separate from your system Python.

Windows:

```powershell
python -m venv backend\.venv
```

macOS:

```bash
python3 -m venv backend/.venv
```

### Step 3: Activate the virtual environment

**When:** every time you open a new terminal to work on the backend.
**Why:** makes `python`, `pip`, `alembic`, and `uvicorn` use the project's packages. You should see `(.venv)` in the prompt.

Windows:

```powershell
.\backend\.venv\Scripts\Activate.ps1
```

If PowerShell blocks it, run this once, then activate again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

macOS:

```bash
source backend/.venv/bin/activate
```

### Step 4: Install backend dependencies

**When:** first time, and again after any `git pull` that changes `requirements.txt`.
**Why:** installs FastAPI, SQLAlchemy, Alembic, asyncpg, psycopg, etc.

Same on both:

```bash
pip install -r requirements.txt
```

### Step 5: Create `backend/.env`

**When:** once, after installing dependencies.
**Why:** the backend reads its secrets and database URL from this file. It is never committed to Git.

Windows:

```powershell
copy backend\.env.example backend\.env
```

macOS:

```bash
cp backend/.env.example backend/.env
```

Then open `backend/.env` and fill in at least:

```env
JWT_SECRET_KEY=<generated secret, see below>
DATABASE_URL=postgresql+asyncpg://<USER>:<PASSWORD>@<HOST>:5432/postgres
```

If the database password has special characters, URL-encode them.

Generate a JWT secret (same on both):

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Why:** every developer must use their own secret. Never reuse someone else's and never commit it.

### Step 6: Verify the config loads

**When:** right after creating `.env`.
**Why:** confirms the file is found and the required values are set, without printing them.

```bash
python -c "from backend.config import settings; print('CONFIG OK'); print('JWT:', bool(settings.jwt_secret_key)); print('DB:', bool(settings.database_url))"
```

Expected: `CONFIG OK`, `JWT: True`, `DB: True`.

### Step 7: Verify the database connection

**When:** after the config check passes.
**Why:** confirms Supabase is reachable with your credentials before you touch migrations.

```bash
python -c "import asyncio; from backend.database import check_database_connection; asyncio.run(check_database_connection()); print('DATABASE CONNECTION: OK')"
```

Expected: `DATABASE CONNECTION: OK`.

### Step 8: Apply migrations

**When:** first time, and after every `git pull` that adds a new file in `backend/alembic/versions/`.
**Why:** creates or updates the database tables to match the models. Never create tables by hand in Supabase.

```bash
alembic current
alembic upgrade head
alembic current
```

`alembic current` before and after shows the version change; the final one should show `55fd1c0613a9` (or a newer revision).

---

## 4. Every time you start the backend

**When:** each development session.
**Why:** `--host 0.0.0.0` lets phones and emulators reach the server; `--reload` restarts it when you edit code.

Windows:

```powershell
cd JodTod
.\backend\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --host 0.0.0.0 --port 5001 --reload
```

macOS:

```bash
cd JodTod
source backend/.venv/bin/activate
uvicorn backend.main:app --host 0.0.0.0 --port 5001 --reload
```

Check it works by opening `http://localhost:5001/health` or running:

Windows:

```powershell
Invoke-WebRequest http://localhost:5001/health
```

macOS:

```bash
curl http://localhost:5001/health
```

Expected: a JSON response with `"status": "ok"`.

---

## 5. Every time you pull changes

**When:** after `git pull`.
**Why:** other developers may have added dependencies or migrations.

```bash
git pull
pip install -r requirements.txt
alembic upgrade head
```

Then start the backend as in section 4.

---

## 6. When you change a database model

**When:** you edit anything in `backend/models/`.
**Why:** the database schema is only changed through Alembic migrations.

```bash
alembic check
alembic revision --autogenerate -m "describe the change"
```

Now **open the generated file in `backend/alembic/versions/` and review it** (tables, columns, nullability, defaults, indexes, foreign keys, downgrade). Then:

```bash
alembic upgrade head
alembic current
```

Rules:

- Never edit a migration that has already been applied. Create a new one instead.
- Never delete applied migration files.
- Make sure any new model is imported so Alembic can see it.

---

## 7. Mobile app (Expo)

### Install and start

**When:** first time, and after `git pull` changes `mobile/package.json`.
**Why:** installs JS dependencies and starts the Expo dev server. Run this in a second terminal while the backend is running.

Windows:

```powershell
cd JodTod\mobile
npm install
npx expo start
```

macOS:

```bash
cd JodTod/mobile
npm install
npx expo start
```

### Set the API address

**When:** the app cannot reach the backend.
**Why:** `localhost` on a phone means the phone itself, so each target needs a different address.

| Where the app runs         | Backend address                      |
| -------------------------- | ------------------------------------ |
| Android emulator           | `http://10.0.2.2:5001`               |
| iOS simulator (macOS only) | `http://localhost:5001`              |
| Web                        | `http://localhost:5001`              |
| Physical phone             | `http://<YOUR-COMPUTER-LAN-IP>:5001` |

Find your LAN IP:

Windows (look for **IPv4 Address**):

```powershell
ipconfig
```

macOS (Wi-Fi is usually `en0`):

```bash
ipconfig getifaddr en0
```

For a physical phone, the phone and computer must be on the same network, the backend must be started with `--host 0.0.0.0`, and the firewall must allow port 5001. Do not commit your personal LAN IP.

---

## 8. Before opening a pull request

**Why:** catches broken imports, schema drift, and accidentally committed secrets.

```bash
git status
alembic check
python -c "import backend.main; print('BACKEND IMPORT OK')"
git diff
```

Then start the backend and confirm `GET /health` works. Make sure the diff contains no `.env`, passwords, tokens, private keys, or personal IP addresses.

---

## 9. Common errors

| Error                                            | Cause                                   | Fix                                                                                          |
| ------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ModuleNotFoundError: No module named 'backend'` | Running from the wrong folder           | `cd` to the repo root and retry                                                              |
| `JWT_SECRET_KEY` or `DATABASE_URL` missing       | `.env` is missing or in the wrong place | It must be at `backend/.env`                                                                 |
| Database connection fails                        | Wrong URL, password, or network         | Read the exact error first; check the URL, URL-encoding of the password, and internet access |
| Mobile app cannot reach backend                  | Wrong API address or firewall           | Recheck the table in section 7 and that the backend is running on `0.0.0.0:5001`             |

---

## 10. Never commit

`backend/.env`, JWT secrets, database passwords, OAuth secrets, Apple private keys, tokens, or anything from your local machine. Keep placeholders only in `.env.example`.

---

## Add Expense Flow Dependencies

### expo-image-picker

Purpose:
Used for the Add Expense bill/receipt image flow, including opening the device camera/image picker and handling the captured receipt image.

Installation:

```bash
npx expo install expo-image-picker
```

## Add Member + Group Invitation + QR Join Dependencies

### expo-camera

Purpose:
Used for the Scan QR to Join flow. Opens the real device camera, requests camera permission, and scans JodTod group invite QR codes (`onBarcodeScanned` with `qr` barcode type). Handles permission denied, cancel, invalid QR, and rescan.

Installation:

```bash
npx expo install expo-camera
```

### react-native-qrcode-svg

Purpose:
Used to render a group's shareable invite QR code on the group Invite screen. Pure JavaScript (draws with the already-installed `react-native-svg`, no native code). Encodes only the opaque group join link (`jodtod://join-group?token=...`), never member lists, expenses, or balances.

Installation:

```bash
npx expo install react-native-qrcode-svg
```
