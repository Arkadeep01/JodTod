"""DB-free regression tests for the notification API shape.

Covers the serializer gap that made GET /api/notifications and
GET /api/notifications/{id} fail: the ORM stores `notification_type`
(enum), `context_data` (JSONB) and native UUIDs, while the API contract
exposes `type` (str), `metadata` (dict) and str ids. Without the mapping
in NotificationItemResponse every serialization raised a ValidationError
(surfaced as HTTP 500).

These tests instantiate the SQLAlchemy model in memory only — no database
is required.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from backend.models.notification import Notification, NotificationType
from backend.schemas.notification import NotificationItemResponse


def _make_notification(**overrides) -> Notification:
    now = datetime.now(timezone.utc)
    attrs = dict(
        id=uuid.uuid4(),
        recipient_user_id=uuid.uuid4(),
        notification_type=NotificationType.EXPENSE_ADDED,
        title="Expense added",
        message="Avery added Dinner for ₹500.",
        related_group_id=uuid.uuid4(),
        related_expense_id=uuid.uuid4(),
        related_settlement_id=None,
        related_user_id=None,
        attachment_reference=None,
        context_data={"amount": "₹500.00", "paid_by": "Avery"},
        read_at=None,
        created_at=now,
        updated_at=now,
    )
    attrs.update(overrides)
    return Notification(**attrs)


def test_orm_row_maps_to_api_shape():
    notif = _make_notification()

    item = NotificationItemResponse.model_validate(notif)

    assert item.id == str(notif.id)
    assert item.type == "expense_added"
    assert item.title == "Expense added"
    assert item.message == notif.message
    assert item.related_group_id == str(notif.related_group_id)
    assert item.related_expense_id == str(notif.related_expense_id)
    assert item.related_settlement_id is None
    assert item.related_user_id is None
    assert item.attachment_reference is None
    assert item.metadata == {"amount": "₹500.00", "paid_by": "Avery"}
    assert item.read_at is None


def test_read_state_and_null_metadata_pass_through():
    read_at = datetime.now(timezone.utc)
    notif = _make_notification(
        notification_type=NotificationType.SYSTEM,
        related_group_id=None,
        related_expense_id=None,
        context_data=None,
        read_at=read_at,
    )

    item = NotificationItemResponse.model_validate(notif)

    assert item.type == "system"
    assert item.metadata is None
    assert item.related_group_id is None
    assert item.read_at == read_at


def test_output_round_trips_through_json_shape():
    """The dumped payload must use the frontend-facing keys."""
    notif = _make_notification()

    payload = NotificationItemResponse.model_validate(notif).model_dump(
        mode="json"
    )

    assert set(payload) == {
        "id",
        "type",
        "title",
        "message",
        "created_at",
        "read_at",
        "related_group_id",
        "related_expense_id",
        "related_settlement_id",
        "related_user_id",
        "attachment_reference",
        "metadata",
    }
    assert payload["type"] == "expense_added"
    assert isinstance(payload["id"], str)
