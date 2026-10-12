"""
JodTod Backend Application

Application entry point for the FastAPI backend.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import logging
from pathlib import Path

from backend.config import settings
from backend.database import (
    initialize_database,
    dispose_database,
)

# FastAPI application instance
from backend.routes.auth_signup import router as auth_signup_router
from backend.routes.auth_login import router as auth_login_router
from backend.routes.auth_logout import router as auth_logout_router
from backend.routes.auth_otp import router as auth_otp_router
from backend.routes.auth_email import router as auth_email_router
from backend.routes.auth_password import router as auth_password_router
from backend.routes.auth_refresh import router as auth_refresh_router
from backend.routes.auth_oauth import router as auth_oauth_router
from backend.routes.activities import router as activities_router
from backend.routes.expenses import router as expenses_router
from backend.routes.groups import router as groups_router
from backend.routes.settlements import router as settlements_router
from backend.routes.users import router as users_router
from backend.routes.preferences import router as preferences_router
from backend.routes.linked_accounts import router as linked_accounts_router
from backend.routes.invitations import router as invitations_router
from backend.routes.notifications import router as notifications_router
from backend.routes.support import router as support_router
from backend.services.auth_signup_service import (
    DuplicateAccountError,
    InvalidSignupError,
    SignupError,
)
from backend.services.auth_login_service import (
    InvalidLoginError,
    LoginError,
)
from backend.services.auth_logout_service import (
    LogoutError,
    SessionNotFoundError as LogoutSessionNotFoundError,
)
from backend.services.otp_service import OTPError
from backend.services.otp_providers import (
    ProviderConfigurationError,
    ProviderDeliveryError,
)
from backend.services.auth_refresh_service import RefreshError
from backend.services.auth_oauth_service import OAuthError


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown lifecycle.
    """

    # Startup (initialize_database retries transient DNS/network blips
    # internally; a persistent failure still aborts startup fail-fast).
    try:
        await initialize_database()
    except Exception:
        logger.exception(
            "Application startup failed: database is unreachable. "
            "Verify DATABASE_URL host/port, network/DNS access, and "
            "that the Supabase project is running."
        )
        raise

    yield

    # Shutdown
    await dispose_database()


app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    debug=settings.debug,
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Profile-photo storage (local filesystem, no paid infrastructure).
#
# Files live under backend/uploads/ and are served read-only at /uploads/.
# users.avatar_url stores the relative reference (e.g.
# "/uploads/profile_photos/<uuid>.jpg") which the mobile app resolves
# against the API base URL.
# ---------------------------------------------------------------------------
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "profile_photos").mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "group_photos").mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR), html=False, check_dir=False),
    name="uploads",
)


# ---------------------------------------------------------------------------
# Authentication Routes

# ---------------------------------------------------------------------------
app.include_router(
    auth_signup_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_login_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_logout_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_otp_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_email_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_password_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_refresh_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    auth_oauth_router,
    prefix="/api",
    tags=["Authentication"],
)

app.include_router(
    users_router,
    prefix="/api",
    tags=["Users"],
)

app.include_router(
    preferences_router,
    prefix="/api",
    tags=["Preferences"],
)

app.include_router(
    support_router,
    prefix="/api",
    tags=["Support"],
)

app.include_router(
    linked_accounts_router,
    prefix="/api",
    tags=["Linked Accounts"],
)

app.include_router(
    invitations_router,
    prefix="/api",
    tags=["Invitations"],
)

app.include_router(
    activities_router,
    prefix="/api",
    tags=["Activities"],
)

app.include_router(
    notifications_router,
    prefix="/api",
    tags=["Notifications"],
)

app.include_router(
    groups_router,
    prefix="/api",
    tags=["Groups"],
)

app.include_router(
    expenses_router,
    prefix="/api",
    tags=["Expenses"],
)

app.include_router(
    settlements_router,
    prefix="/api",
    tags=["Settlements"],
)


# ---------------------------------------------------------------------------
# Signup error handlers
#
# The signup service raises typed errors; map them to safe HTTP responses.
# Raw database/integrity details are never exposed to the client.
# ---------------------------------------------------------------------------
@app.exception_handler(DuplicateAccountError)
async def duplicate_account_handler(
    request: Request,
    exc: DuplicateAccountError,
):
    return JSONResponse(
        status_code=409,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(InvalidSignupError)
async def invalid_signup_handler(
    request: Request,
    exc: InvalidSignupError,
):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(SignupError)
async def signup_error_handler(
    request: Request,
    exc: SignupError,
):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "code": exc.code},
    )


# ---------------------------------------------------------------------------
# Login error handlers
#
# Every login failure maps to the same generic 401 response so clients
# cannot distinguish unknown accounts from wrong passwords.
# ---------------------------------------------------------------------------
@app.exception_handler(InvalidLoginError)
async def invalid_login_handler(
    request: Request,
    exc: InvalidLoginError,
):
    return JSONResponse(
        status_code=401,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(LoginError)
async def login_error_handler(
    request: Request,
    exc: LoginError,
):
    return JSONResponse(
        status_code=401,
        content={"detail": exc.message, "code": exc.code},
    )


# ---------------------------------------------------------------------------
# Logout error handlers
# ---------------------------------------------------------------------------
@app.exception_handler(LogoutSessionNotFoundError)
async def logout_session_not_found_handler(
    request: Request,
    exc: LogoutSessionNotFoundError,
):
    return JSONResponse(
        status_code=404,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(LogoutError)
async def logout_error_handler(
    request: Request,
    exc: LogoutError,
):
    return JSONResponse(
        status_code=400,
        content={"detail": exc.message, "code": exc.code},
    )


# ---------------------------------------------------------------------------
# OTP / verification / recovery error handlers
#
# Every OTP-family error carries its own safe message, code, and HTTP
# status (429 for cooldown/rate-limit/lockout, 404 only where the
# caller supplied the destination, never account existence).
# ---------------------------------------------------------------------------
@app.exception_handler(OTPError)
async def otp_error_handler(
    request: Request,
    exc: OTPError,
):
    status_code = getattr(exc, "status_code", 400)
    return JSONResponse(
        status_code=status_code,
        content={"detail": exc.message, "code": exc.code},
    )


@app.exception_handler(ProviderConfigurationError)
async def provider_configuration_error_handler(
    request: Request,
    exc: ProviderConfigurationError,
):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Email delivery is not configured.",
            "code": "EMAIL_PROVIDER_NOT_CONFIGURED",
        },
    )


@app.exception_handler(ProviderDeliveryError)
async def provider_delivery_error_handler(
    request: Request,
    exc: ProviderDeliveryError,
):
    return JSONResponse(
        status_code=502,
        content={
            "detail": "Email delivery was rejected by the provider.",
            "code": "EMAIL_PROVIDER_REJECTED",
        },
    )


# ---------------------------------------------------------------------------
# Refresh error handler (single generic 401; no oracle)
# ---------------------------------------------------------------------------
@app.exception_handler(RefreshError)
async def refresh_error_handler(
    request: Request,
    exc: RefreshError,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code},
    )


# ---------------------------------------------------------------------------
# OAuth error handlers
# ---------------------------------------------------------------------------
@app.exception_handler(OAuthError)
async def oauth_error_handler(
    request: Request,
    exc: OAuthError,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code},
    )


@app.get("/")
async def home():
    print("This is the JodTod Backend")
    return {"message": "Welcome to the JodTod Backend!"}


@app.get("/api/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """
    Basic application health endpoint.
    """
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.api_version,
    }
