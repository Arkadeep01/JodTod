from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from backend.models.notification import Notification, NotificationType


class NotificationItemResponse(BaseModel):
    id: str
    type: str
    title: str
    message: str
    created_at: datetime
    read_at: datetime | None = None
    related_group_id: str | None = None
    related_expense_id: str | None = None
    related_settlement_id: str | None = None
    related_user_id: str | None = None
    attachment_reference: str | None = None
    metadata: dict | None = None

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _map_orm_fields(cls, data: Any) -> Any:
        """Translate ORM attribute names to the API shape.

        The Notification model stores `notification_type` (enum),
        `context_data` (JSONB) and native UUIDs; the API contract
        exposes `type` (str), `metadata` (dict) and str ids. Without
        this mapping every list/detail serialization fails validation
        and the endpoints return 500.
        """
        if isinstance(data, Notification):
            notification_type = data.notification_type
            return {
                "id": str(data.id),
                "type": (
                    notification_type.value
                    if isinstance(notification_type, NotificationType)
                    else str(notification_type)
                ),
                "title": data.title,
                "message": data.message,
                "created_at": data.created_at,
                "read_at": data.read_at,
                "related_group_id": (
                    str(data.related_group_id)
                    if data.related_group_id is not None
                    else None
                ),
                "related_expense_id": (
                    str(data.related_expense_id)
                    if data.related_expense_id is not None
                    else None
                ),
                "related_settlement_id": (
                    str(data.related_settlement_id)
                    if data.related_settlement_id is not None
                    else None
                ),
                "related_user_id": (
                    str(data.related_user_id)
                    if data.related_user_id is not None
                    else None
                ),
                "attachment_reference": data.attachment_reference,
                "metadata": data.context_data,
            }
        return data


class NotificationResponse(NotificationItemResponse):
    pass


class NotificationCreate(BaseModel):
    recipient_user_id: UUID
    notification_type: NotificationType
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1)
    related_group_id: UUID | None = None
    related_expense_id: UUID | None = None
    related_settlement_id: UUID | None = None
    related_user_id: UUID | None = None
    attachment_reference: str | None = None
    metadata: dict | None = None


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int


class MarkNotificationReadRequest(BaseModel):
    notification_id: UUID


class UnreadCountResponse(BaseModel):
    unread_count: int