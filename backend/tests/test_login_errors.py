"""Login failure-contract regression tests (no database required).

Every password-login failure must surface the same generic
INVALID_CREDENTIALS error so callers cannot distinguish unknown
accounts from wrong passwords (no account-enumeration oracle).
"""

from datetime import datetime, timezone

import pytest

from backend.core.security import hash_password, verify_password
from backend.models.user import AccountStatus, User
from backend.services.auth_login_service import (
    InvalidLoginError,
    _ensure_account_may_authenticate,
)


def _user(**overrides) -> User:
    base = {
        "email": "case@jodtod.test",
        "is_active": True,
        "account_status": AccountStatus.ACTIVE,
        "deleted_at": None,
        "password_hash": hash_password("correct-password-12"),
    }
    base.update(overrides)
    return User(**base)


def test_invalid_login_error_is_generic():
    err = InvalidLoginError("Invalid credentials.")
    assert err.code == "INVALID_CREDENTIALS"
    assert "Invalid credentials." in err.message


@pytest.mark.parametrize(
    "overrides",
    [
        {"is_active": False},
        {"deleted_at": datetime.now(timezone.utc)},
        {"account_status": AccountStatus.SUSPENDED},
        {"account_status": AccountStatus.DISABLED},
        {"account_status": AccountStatus.DELETED},
        {"password_hash": None},
    ],
)
def test_ineligible_accounts_all_raise_generic(overrides):
    with pytest.raises(InvalidLoginError) as exc_info:
        _ensure_account_may_authenticate(_user(**overrides))
    assert exc_info.value.code == "INVALID_CREDENTIALS"


@pytest.mark.parametrize(
    "status",
    [AccountStatus.ACTIVE, AccountStatus.PENDING],
)
def test_eligible_accounts_pass(status):
    # PENDING (unverified) accounts may still authenticate; verification
    # is a separate flow. Must not raise.
    _ensure_account_may_authenticate(_user(account_status=status))


def test_password_verification_round_trip():
    stored = hash_password("pw-admin123")
    assert stored != "pw-admin123"
    assert verify_password("pw-admin123", stored) is True
    assert verify_password("wrongpassword12", stored) is False
    assert verify_password("", stored) is False
