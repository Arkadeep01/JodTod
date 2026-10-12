# backend/services/group_photo_service.py

"""
Group-photo storage for group admins.

Mirrors the profile-photo system (no paid infrastructure): files live
under ``backend/uploads/group_photos/`` and are served by the API at
``/uploads/...``. PostgreSQL (groups.image_url) is the source of truth
for the persisted reference — a relative path such as
``/uploads/group_photos/<uuid>.jpg``.

Safety rules (same as profile photos):
- the caller passes the already-fetched Group; membership/admin
  authorization stays in the route/service layer, never here.
- MIME type, extension, and size are validated before anything is stored.
- stored filenames are server-generated UUIDs; the original filename
  is never trusted or used.
- the old photo is deleted only AFTER the new reference commits.
- a failed upload never mutates the existing image_url.
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Final

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import transaction
from backend.models.group import Group

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_ROOT: Final[Path] = BASE_DIR / "uploads" / "group_photos"

MAX_PHOTO_BYTES: Final[int] = 5 * 1024 * 1024  # 5 MB

ALLOWED_CONTENT_TYPES: Final[dict[str, str]] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

ALLOWED_EXTENSIONS: Final[set[str]] = {".jpg", ".jpeg", ".png", ".webp"}


class GroupPhotoError(Exception):
    """Base error for group-photo operations."""

    def __init__(self, message: str, code: str = "GROUP_PHOTO_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


class InvalidGroupPhotoError(GroupPhotoError):
    """Raised when the uploaded file fails validation (400)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="INVALID_GROUP_PHOTO")


class GroupPhotoTooLargeError(GroupPhotoError):
    """Raised when the upload exceeds the size limit (413)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="GROUP_PHOTO_TOO_LARGE")


class GroupPhotoStorageError(GroupPhotoError):
    """Raised when the file cannot be stored (500)."""

    def __init__(
        self, message: str = "Could not store the group photo."
    ) -> None:
        super().__init__(message, code="GROUP_PHOTO_STORAGE_FAILED")


def _resolve_extension(content_type: str | None, filename: str | None) -> str:
    """
    Resolve a safe extension from the validated content type.

    The content type wins; the original filename extension is only a
    fallback and must itself be allowlisted. Never returns an
    unvalidated extension.
    """
    if content_type:
        normalized = content_type.split(";")[0].strip().lower()
        if normalized in ALLOWED_CONTENT_TYPES:
            return ALLOWED_CONTENT_TYPES[normalized]

    if filename and "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].strip().lower()
        if ext in ALLOWED_EXTENSIONS:
            return ".jpg" if ext == ".jpeg" else ext

    raise InvalidGroupPhotoError(
        "Unsupported image type. Use JPEG, PNG, or WebP."
    )


# Every file this service writes is named {uuid4-hex}{ext}; only such
# names are ever resolved back. Anything else (traversal payloads,
# foreign URLs, other folders' files) is ignored rather than mapped to
# an unintended sibling file.
_GENERATED_NAME = re.compile(r"[0-9a-f]{32}\.(jpg|png|webp)")


def _photo_path(image_url: str | None) -> Path | None:
    """Resolve a stored image_url to an on-disk path, or None."""
    if not image_url:
        return None
    # Only paths we generated (under /uploads/group_photos/) resolve
    # inside UPLOAD_ROOT; anything else is ignored to prevent path traversal.
    name = image_url.strip().replace("\\", "/").split("/")[-1]
    if not name or name in (".", ".."):
        return None
    if _GENERATED_NAME.fullmatch(name) is None:
        return None
    candidate = UPLOAD_ROOT / name
    try:
        candidate.resolve().relative_to(UPLOAD_ROOT.resolve())
    except (ValueError, OSError):
        return None
    return candidate


class GroupPhotoService:
    """Upload / replacement / removal for a group's photo."""

    @staticmethod
    async def set_group_photo(
        db: AsyncSession,
        group: Group,
        upload: UploadFile,
    ) -> str:
        """
        Validate, store, and persist a new group photo.

        Returns the new image_url. The previous file is removed only
        after the new reference commits. On any failure the existing
        image_url is left untouched.
        """
        extension = _resolve_extension(upload.content_type, upload.filename)

        try:
            contents = await upload.read()
        except Exception as exc:
            raise GroupPhotoStorageError() from exc
        finally:
            try:
                await upload.close()
            except Exception:
                pass

        if not contents:
            raise InvalidGroupPhotoError("The uploaded file is empty.")

        if len(contents) > MAX_PHOTO_BYTES:
            raise GroupPhotoTooLargeError(
                "The image is too large. Maximum size is 5 MB."
            )

        UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{extension}"
        dest = UPLOAD_ROOT / filename

        try:
            dest.write_bytes(contents)
        except OSError as exc:
            raise GroupPhotoStorageError() from exc

        previous_url = group.image_url
        new_url = f"/uploads/group_photos/{filename}"

        try:
            async with transaction(db):
                group.image_url = new_url
                await db.flush()
        except Exception:
            # DB did not persist: remove the orphan file, keep old reference.
            try:
                dest.unlink(missing_ok=True)
            except OSError:
                pass
            raise

        # New reference is safely persisted; clean up the old file.
        previous_path = _photo_path(previous_url)
        if previous_path is not None and previous_path != dest:
            try:
                previous_path.unlink(missing_ok=True)
            except OSError:
                pass

        return new_url

    @staticmethod
    async def clear_group_photo(
        db: AsyncSession,
        group: Group,
    ) -> None:
        """
        Clear the image reference and delete the stored file.

        Safe when no photo exists or the file is already missing.
        """
        previous_url = group.image_url

        async with transaction(db):
            group.image_url = None
            await db.flush()

        previous_path = _photo_path(previous_url)
        if previous_path is not None:
            try:
                previous_path.unlink(missing_ok=True)
            except OSError:
                pass
