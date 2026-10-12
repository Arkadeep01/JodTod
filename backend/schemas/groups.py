# backend/schemas/groups.py

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class MoneyMixin(BaseModel):
    """Serialize Decimal money as 2dp strings (never float)."""

    model_config = ConfigDict(from_attributes=True)


class CreateGroupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    group_type: str = "other"
    currency: str = Field(default="INR", min_length=3, max_length=3)
    member_user_ids: list[UUID] = Field(default_factory=list)
    image_url: Optional[str] = Field(default=None, max_length=500)


class AddMemberRequest(BaseModel):
    user_id: UUID


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=120)
    description: Optional[str] = Field(default=None, max_length=500)
    group_type: Optional[str] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    clear_description: bool = False
    clear_image_url: bool = False


class UpdateGroupResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    group_type: str
    currency: str
    image_url: Optional[str] = None
    lifecycle: str
    invite_code: Optional[str] = None


class JoinGroupRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=32)


class GroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    display_name: str
    avatar_url: Optional[str] = None
    role: str
    net_balance: str = "0.00"


class GroupSummaryResponse(BaseModel):
    """One group in the Settle list: identity + my position."""

    id: UUID
    name: str
    group_type: str
    currency: str
    image_url: Optional[str] = None
    lifecycle: str
    settlement_status: str
    member_count: int
    you_owe: str = "0.00"
    you_are_owed: str = "0.00"
    pending_count: int = 0
    invite_code: Optional[str] = None


class GroupListResponse(BaseModel):
    groups: list[GroupSummaryResponse] = Field(default_factory=list)


class GroupDetailResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    group_type: str
    currency: str
    image_url: Optional[str] = None
    lifecycle: str
    settlement_status: str
    member_count: int
    my_net: str = "0.00"
    my_direction: str = "SETTLED"
    confirmed_count: int = 0
    invite_code: Optional[str] = None
    members: list[GroupMemberResponse] = Field(default_factory=list)


class SuggestionResponse(BaseModel):
    payer_user_id: UUID
    payer_name: str
    payer_avatar_url: Optional[str] = None
    receiver_user_id: UUID
    receiver_name: str
    receiver_avatar_url: Optional[str] = None
    amount: str
    currency: str


class SuggestionListResponse(BaseModel):
    group_id: UUID
    group_name: str
    suggestions: list[SuggestionResponse] = Field(default_factory=list)


class ArchiveGroupResponse(BaseModel):
    id: UUID
    lifecycle: str


class InviteCodeResponse(BaseModel):
    id: UUID
    invite_code: str


class LeaveGroupResponse(BaseModel):
    id: UUID
    status: str


class GroupPhotoResponse(BaseModel):
    id: UUID
    image_url: Optional[str] = None


def money_str(value: Decimal | int | str) -> str:
    if isinstance(value, Decimal):
        quantized = value.quantize(Decimal("0.01"))
        return format(quantized, ".2f")
    return money_str(Decimal(str(value)))
