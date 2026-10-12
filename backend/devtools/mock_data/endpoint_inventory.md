# JodTod API Endpoint Inventory

Generated from `backend/main.py` + `backend/routes/*.py` (repo commit `2859e17`).
All routers are mounted under the global prefix `/api`. Auth = HTTPBearer JWT access token.

Status codes below are the **success** codes declared by the route. Error codes are
listed where the route explicitly maps them. `BLOCKED`/`NOT TESTED` in the checklist
refer to the verification checklist, not to this inventory.

## Authentication (`/api/auth`) — `backend/routes/auth_*.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-001 | POST | `/api/auth/signup` | none | `SignupRequest` | 201 | at least one of email/phone; password optional |
| EP-002 | POST | `/api/auth/login` | none | `LoginRequest` | 200 | identifier + password → `AuthResponse` (no OTP) |
| EP-003 | POST | `/api/auth/logout` | bearer | `LogoutRequest\|null` | 200 | revokes current or provided session |
| EP-004 | POST | `/api/auth/send-otp` | none | `SendOTPRequest` | 200 | phone-login requires existing account |
| EP-005 | POST | `/api/auth/verify-otp` | none | `VerifyOTPRequest` | 200 | phone/email login → `AuthResponse`; else `OTPResponse` |
| EP-006 | POST | `/api/auth/send-email-verification` | none | `SendEmailVerificationRequest` | 200 | 6-digit code |
| EP-007 | POST | `/api/auth/verify-email` | none | `VerifyEmailCodeRequest` | 200 | `{email, code}` |
| EP-008 | POST | `/api/auth/forgot-password` | none | `ForgotPasswordRequest` | 200 | no account-enumeration (always same response) |
| EP-009 | POST | `/api/auth/reset-password` | none | `ResetPasswordRequest` | 200 | revokes all sessions |
| EP-010 | POST | `/api/auth/refresh` | none | `RefreshTokenRequest` | 200 | rotation; reuse revokes token family |
| EP-011 | POST | `/api/auth/google` | none | `OAuthRequest` | 200 | server verifies ID token |
| EP-012 | POST | `/api/auth/apple` | none | `OAuthRequest` | 200 | needs Apple config else 503 |

## Users / profile / sessions (`/api/users`) — `backend/routes/users.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-013 | GET | `/api/users/me` | bearer | — | 200 | identity from Bearer only |
| EP-014 | GET | `/api/users/me/profile` | bearer | — | 200 | dashboard aggregate |
| EP-015 | PATCH | `/api/users/me` | bearer | `UpdateProfileRequest` | 200 | name/username/phone; 409 collision; 400 blank name |
| EP-016 | POST | `/api/users/me/photo` | bearer | multipart `photo` | 200 | 400 invalid, 413 too large, 500 storage |
| EP-017 | DELETE | `/api/users/me/photo` | bearer | — | 200 | idempotent |
| EP-018 | GET | `/api/users/sessions` | bearer | — | 200 | newest first, `current` flag |
| EP-019 | POST | `/api/users/sessions/{session_id}/revoke` | bearer | — | 200 | 404 unknown session |

## Preferences + counts (`/api/users/me/...`) — `backend/routes/preferences.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-020 | GET | `/api/users/me/preferences` | bearer | — | 200 | materializes defaults if missing |
| EP-021 | PATCH | `/api/users/me/preferences` | bearer | `UpdatePreferencesRequest` | 200 | 422 bad enum, 400 service re-check |
| EP-022 | GET | `/api/users/me/notifications/counts` | bearer | — | 200 | derived from activity rows |

## Linked accounts (`/api/users/me/linked-accounts`) — `backend/routes/linked_accounts.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-023 | GET | `/api/users/me/linked-accounts` | bearer | — | 200 | safe state only |
| EP-024 | POST | `/api/users/me/linked-accounts/{provider}/link` | bearer | `LinkProviderRequest` | 200 | 409 cross-user subject; 503 unconfigured provider |
| EP-025 | DELETE | `/api/users/me/linked-accounts/{provider}/unlink` | bearer | — | 200 | 409 when last sign-in method |

## Support (`/api/support`) — `backend/routes/support.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-026 | GET | `/api/support/faqs` | bearer | query `category`,`q` | 200 | active rows in curated order |
| EP-027 | POST | `/api/support/requests` | bearer | `CreateSupportRequest` | 201 | type in support/bug/feature_request |
| EP-028 | GET | `/api/support/requests` | bearer | — | 200 | own rows only |

## Invitations (`/api/invitations`) — `backend/routes/invitations.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-029 | GET | `/api/invitations/mine` | bearer | — | 200 | pending invitee rows |
| EP-030 | POST | `/api/invitations` | bearer | `CreateInvitationRequest` | 200 | invitee must exist |
| EP-031 | POST | `/api/invitations/{id}/accept` | bearer | — | 200 | 404 not owner/unknown |
| EP-032 | POST | `/api/invitations/{id}/decline` | bearer | — | 200 | 404 not owner/unknown |

## Activities (`/api/activities`) — `backend/routes/activities.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-033 | GET | `/api/activities` | bearer | filters (type, member[], group[], date_range, q, limit, offset) | 200 | newest first, user-scoped |
| EP-034 | GET | `/api/activities/{activity_id}` | bearer | — | 200 | 404 other user's row |
| EP-035 | POST | `/api/activities` | bearer | `ActivityCreate` | 201 | append to own feed |

## Notifications (`/api/notifications`) — `backend/routes/notifications.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-036 | GET | `/api/notifications` | bearer | filters (type, read, limit, offset) | 200 | 400 unknown type |
| EP-037 | GET | `/api/notifications/{notification_id}` | bearer | — | 200 | 404 other user's row |
| EP-038 | POST | `/api/notifications/{notification_id}/read` | bearer | body ignored | 200 | marks read |
| EP-039 | GET | `/api/notifications/unread/count` | bearer | — | 200 | badge source |

## Groups (`/api/groups`) — `backend/routes/groups.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-040 | POST | `/api/groups` | bearer | `CreateGroupRequest` | 200 | creator becomes admin |
| EP-041 | GET | `/api/groups` | bearer | — | 200 | membership-scoped, live balances |
| EP-042 | POST | `/api/groups/join` | bearer | `JoinGroupRequest` | 200 | 404 bad code |
| EP-043 | GET | `/api/groups/{group_id}` | bearer | — | 200 | 404 non-member |
| EP-044 | PATCH | `/api/groups/{group_id}` | bearer | `UpdateGroupRequest` | 200 | 403 non-admin |
| EP-045 | POST | `/api/groups/{group_id}/members` | bearer | `AddMemberRequest` | 200 | requester must be member |
| EP-046 | DELETE | `/api/groups/{group_id}/members/me` | bearer | — | 200 | last member removes group |
| EP-047 | POST | `/api/groups/{group_id}/archive` | bearer | — | 200 | 403 non-admin |
| EP-048 | POST | `/api/groups/{group_id}/invite-code/rotate` | bearer | — | 200 | 403 non-admin |
| EP-049 | GET | `/api/groups/{group_id}/suggestions` | bearer | — | 200 | min-transaction plan |
| EP-050 | GET | `/api/groups/search/by-code` | bearer | query `code` | 200 | 404 invalid code |

## Expenses (`/api/expenses`) — `backend/routes/expenses.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-051 | POST | `/api/expenses` | bearer | `CreateExpenseRequest` | 200 | 404 non-member group; 422 bad split |
| EP-052 | GET | `/api/expenses` | bearer | query `group_id` (required), `limit`, `offset` | 200 | membership-scoped |

## Settlements (`/api/settlements`) — `backend/routes/settlements.py`

| ID | Method | Path | Auth | Req body | Success | Notes |
|----|--------|------|------|----------|---------|-------|
| EP-053 | GET | `/api/settlements/people` | bearer | query `q`,`direction`,`limit`,`offset` | 200 | non-zero relationships |
| EP-054 | GET | `/api/settlements/people/{person_id}` | bearer | — | 200 | 404 no relationship |
| EP-055 | GET | `/api/settlements/people/{person_id}/history` | bearer | query `limit`,`offset` | 200 | confirmed only |
| EP-056 | GET | `/api/settlements/pending-confirmations` | bearer | query `limit`,`offset` | 200 | receiver inbox |
| EP-057 | GET | `/api/settlements/groups/{group_id}/history` | bearer | query `limit`,`offset` | 200 | 404 non-member |
| EP-058 | POST | `/api/settlements` | bearer | `InitiateSettlementRequest` | 200 | payer only; 422/404 |
| EP-059 | GET | `/api/settlements/{settlement_id}` | bearer | — | 200 | shared-group scoped |
| EP-060 | POST | `/api/settlements/{settlement_id}/confirm` | bearer | — | 200 | receiver only; 403/409 |
| EP-061 | POST | `/api/settlements/{settlement_id}/reject` | bearer | `RejectSettlementRequest` | 200 | receiver only |
| EP-062 | POST | `/api/settlements/{settlement_id}/cancel` | bearer | — | 200 | payer only |

## Health

| ID | Method | Path | Auth | Success | Notes |
|----|--------|------|------|---------|-------|
| EP-063 | GET | `/api/health` | none | 200 | reachability probe used by mobile |
| EP-064 | GET | `/` | none | 200 | root banner |

## Frontend ↔ backend cross-check

All paths referenced by `app/src/services/*.api.ts` and `app/src/constants/auth.constants.ts`
match the routes above. Notable observations (not bugs, report only):

- `auth.constants.ts` declares `SEND_EMAIL_VERIFICATION`, `FORGOT_PASSWORD`, `RESET_PASSWORD`
  and both are wired to real backend routes.
- No frontend client calls the session-management routes (`/api/users/sessions*`) yet;
  they are backend-only.
- `POST /api/notifications/{id}/read` accepts a body that the handler ignores (path id wins).
- `GET /api/groups/search/by-code` is declared **after** `/api/groups/{group_id}`; FastAPI
  matches the literal `/search/by-code` before the `{group_id}` param because route order
  within the router is preserved and the literal segment is declared last — verify at runtime
  during the checklist (potential routing-order risk to watch).
