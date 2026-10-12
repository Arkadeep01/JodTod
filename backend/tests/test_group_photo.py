"""
Tests for group photos (POST/DELETE /api/groups/{id}/photo).

Upload/storage mirrors the profile-photo system: local files under
backend/uploads/group_photos/, served at /uploads/..., groups.image_url
is the source of truth. Mutations are admin-only (403 otherwise);
non-members read 404.

Conventions follow test_group_update.py: the shared `db` fixture
provides a clean async session; endpoint tests drive the ASGI app
with httpx and override `get_db`. Pure validation tests (no DB) run
anywhere.
"""

from __future__ import annotations

from io import BytesIO
from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import delete

from backend.database import get_db
from backend.main import app
from backend.models.activity import Activity
from backend.models.group import Group, GroupMember
from backend.models.user import AccountStatus, User
from backend.services.group_photo_service import (
    UPLOAD_ROOT,
    InvalidGroupPhotoError,
    _photo_path,
    _resolve_extension,
)
from backend.services.group_service import GroupService


# ---------------------------------------------------------------------------
# Pure validation tests (no database required)
# ---------------------------------------------------------------------------


def test_resolve_extension_prefers_content_type():
    assert _resolve_extension("image/jpeg", "photo.png") == ".jpg"
    assert _resolve_extension("image/png", None) == ".png"
    assert _resolve_extension("image/webp; charset=binary", "a.jpg") == ".webp"


def test_resolve_extension_falls_back_to_allowlisted_filename():
    assert _resolve_extension(None, "photo.PNG") == ".png"
    assert _resolve_extension(None, "photo.jpeg") == ".jpg"
    assert _resolve_extension("", "photo.webp") == ".webp"


def test_resolve_extension_rejects_unknown_types():
    with pytest.raises(InvalidGroupPhotoError):
        _resolve_extension("image/gif", "photo.gif")
    with pytest.raises(InvalidGroupPhotoError):
        _resolve_extension(None, "photo.bmp")
    with pytest.raises(InvalidGroupPhotoError):
        _resolve_extension(None, None)


def test_photo_path_rejects_traversal_and_foreign_urls():
    assert _photo_path(None) is None
    assert _photo_path("") is None
    assert _photo_path("/uploads/group_photos/../../etc/passwd") is None
    assert _photo_path("..") is None
    assert _photo_path("https://example.com/x.jpg") is None
    assert _photo_path("/uploads/profile_photos/abc.jpg") is None


def test_photo_path_accepts_own_references():
    name = "a" * 32 + ".jpg"
    path = _photo_path(f"/uploads/group_photos/{name}")
    assert path is not None
    assert path.parent == UPLOAD_ROOT
    assert path.name == name


# ---------------------------------------------------------------------------
# Endpoint tests (need the scratch DB; same style as test_group_update.py)
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def admin_and_member(db):
    """Admin + plain member users with one group; cleaned up after."""
    users = []
    for label in ("Admin", "Member"):
        user = User(
            name=f"Photo {label}",
            email=f"photo-{label.lower()}-{uuid4().hex[:8]}@example.com",
            phone=None,
            password_hash="hash",
            account_status=AccountStatus.ACTIVE,
            email_verified=True,
            phone_verified=False,
        )
        db.add(user)
        users.append(user)
    await db.flush()
    admin, member = users
    group = await GroupService.create_group(
        db,
        creator_id=admin.id,
        name="Photo Group",
        group_type="other",
        member_user_ids=[member.id],
    )
    await db.commit()
    yield admin, member, group
    await db.execute(
        delete(Activity).where(Activity.user_id.in_([admin.id, member.id]))
    )
    await db.execute(
        delete(GroupMember).where(GroupMember.group_id == group.id)
    )
    await db.execute(delete(Group).where(Group.id == group.id))
    await db.execute(delete(User).where(User.id.in_([admin.id, member.id])))
    await db.commit()


async def _auth_headers(db, user) -> dict[str, str]:
    from backend.services.session_service import SessionService

    _, token_data = await SessionService.create_session(db, user)
    await db.flush()
    return {"Authorization": f"Bearer {token_data['access_token']}"}


def _asgi_client(db):
    async def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


def _clear_overrides():
    app.dependency_overrides.pop(get_db, None)


def _png_bytes() -> bytes:
    # Minimal valid PNG (1x1). Content is never rendered in tests.
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
        b"\x0d\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )


@pytest.mark.asyncio
async def test_upload_and_remove_round_trip(db, admin_and_member):
    admin, _, group = admin_and_member
    client = _asgi_client(db)
    try:
        headers = await _auth_headers(db, admin)
        resp = await client.post(
            f"/api/groups/{group.id}/photo",
            headers=headers,
            files={"photo": ("g.png", BytesIO(_png_bytes()), "image/png")},
        )
        assert resp.status_code == 200, resp.text
        first_url = resp.json()["image_url"]
        assert first_url.startswith("/uploads/group_photos/")

        # Replacement swaps the reference (old file cleaned up).
        resp2 = await client.post(
            f"/api/groups/{group.id}/photo",
            headers=headers,
            files={"photo": ("g2.png", BytesIO(_png_bytes()), "image/png")},
        )
        assert resp2.status_code == 200, resp2.text
        assert resp2.json()["image_url"].startswith("/uploads/group_photos/")
        assert resp2.json()["image_url"] != first_url

        # Removal clears the reference; second removal is safe.
        del_resp = await client.delete(
            f"/api/groups/{group.id}/photo", headers=headers
        )
        assert del_resp.status_code == 200, del_resp.text
        assert del_resp.json()["image_url"] is None
        del_again = await client.delete(
            f"/api/groups/{group.id}/photo", headers=headers
        )
        assert del_again.status_code == 200, del_again.text
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.asyncio
async def test_upload_rejects_non_admin_and_unknown_group(db, admin_and_member):
    admin, member, group = admin_and_member
    client = _asgi_client(db)
    try:
        member_headers = await _auth_headers(db, member)
        admin_headers = await _auth_headers(db, admin)
        denied = await client.post(
            f"/api/groups/{group.id}/photo",
            headers=member_headers,
            files={"photo": ("g.png", BytesIO(_png_bytes()), "image/png")},
        )
        assert denied.status_code == 403, denied.text

        denied_del = await client.delete(
            f"/api/groups/{group.id}/photo", headers=member_headers
        )
        assert denied_del.status_code == 403, denied_del.text

        missing = await client.post(
            f"/api/groups/{uuid4()}/photo",
            headers=admin_headers,
            files={"photo": ("g.png", BytesIO(_png_bytes()), "image/png")},
        )
        assert missing.status_code == 404, missing.text

        bad_type = await client.post(
            f"/api/groups/{group.id}/photo",
            headers=admin_headers,
            files={"photo": ("g.gif", BytesIO(b"GIF89a"), "image/gif")},
        )
        assert bad_type.status_code == 400, bad_type.text
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.asyncio
async def test_upload_rejects_oversize(db, admin_and_member):
    admin, _, group = admin_and_member
    client = _asgi_client(db)
    try:
        headers = await _auth_headers(db, admin)
        big = await client.post(
            f"/api/groups/{group.id}/photo",
            headers=headers,
            files={"photo": ("big.png", BytesIO(b"x" * (6 * 1024 * 1024)), "image/png")},
        )
        assert big.status_code == 413, big.text
    finally:
        await client.aclose()
        _clear_overrides()
