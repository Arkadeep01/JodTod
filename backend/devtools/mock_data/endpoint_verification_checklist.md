# JodTod Endpoint Verification Checklist

Evidence-based verification of every endpoint in `endpoint_inventory.json`. Status: **PASS** / **FAIL** / **BLOCKED** / **NOT TESTED**.

## Run summary (2026-10-11, local Docker Postgres)

- Target: `localhost:55432`, db `jodtod_local` (throwaway). Shared Supabase **not touched**.
- Providers: `EMAIL_PROVIDER=mock`, `OTP_PROVIDER=mock`; auth-gated calls use real Bearer sessions.
- `alembic upgrade head` + `seed_data.py` + `verify_seed.py` → **11 PASS / 0 FAIL**.
- `POST /api/auth/login` as `arkadeep@admin.com` → **PASS** (wrong password → 401).
- Endpoints: **64 total / 37 PASS / 19 FAIL / 8 BLOCKED / 0 NOT TESTED**.

### Findings (pre-existing backend bugs)

- **BUG-1-reserved-tld-login-500** (high): All seeded @jodtod.test users cannot authenticate.  
  - POST /api/auth/login avery@jodtod.test -> HTTP 500: pydantic EmailStr rejects the reserved .test TLD in AuthenticatedUser.model_validate (auth_login_service.py:178). Signup with a .test email -> 422. Only arkadeep@admin.com works.
- **BUG-2-notification-serializer-500** (high): GET/POST notification endpoints 500 for any user with rows.  
  - EP-036 GET /api/notifications -> 500; NotificationItemResponse declares id:str/type:str/metadata but the ORM model exposes notification_type/context_data/UUID ids (schemas/notification.py vs models/notification.py).
- **BUG-3-silent-rollback-writes** (critical): Group/expense/settlement/invitation writes return 200 but roll back.  
  - Verified against jodtod_local: group rename/archive/rotate, join, add-member, expense create, settlement initiate and invitation create/accept all returned 200 with no persisted row (groups.name and invite_code unchanged; avery not added; arkadeep not in goa_trip; expenses stayed 7; no new settlement/invitation). Services read before `async with transaction(db)`, which cannot own the already-autobegun request session (same class as the previously fixed PATCH /users/me bug).

## Per-endpoint results

| ID | Method | Path | HTTP | Status | Evidence / reason |
|----|--------|------|------|--------|-------------------|
| EP-001 | POST | `/api/auth/signup` | 201 | **PASS** | {"user": {"name": "Endpoint Verify", "email": "endpoint-verify-signup+672af68f60@admin.com", "phone": null, "id": "9e4cd922-b0e7-4bcb-9bbe-7eb742861c4a", "us... |
| EP-002 | POST | `/api/auth/login` | 200 | **PASS** | {"user": {"name": "Arkadeep", "email": "arkadeep@admin.com", "phone": "+919000000005", "id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "username": "arkadeep", ... |
| EP-003 | POST | `/api/auth/logout` | 200 | **PASS** | {"message": "Logged out."} |
| EP-004 | POST | `/api/auth/send-otp` | 200 | **PASS** | {"message": "Code generated, but no real SMS/email delivery provider is configured.", "expires_at": "2026-10-10T18:41:50.080830Z", "retry_after_seconds": nul... |
| EP-005 | POST | `/api/auth/verify-otp` | 200 | **PASS** | {"user": {"name": "Arkadeep", "email": "arkadeep@admin.com", "phone": "+919000000005", "id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "username": "arkadeep", ... |
| EP-006 | POST | `/api/auth/send-email-verification` | 422 | **BLOCKED** | Mock EMAIL_PROVIDER reports accepted=False by design, so issuance is invalidated and no dev_code is returned. Positive run needs real SMTP creds. |
| EP-007 | POST | `/api/auth/verify-email` | None | **BLOCKED** | No dev_code; blocked on EP-006 / real SMTP. |
| EP-008 | POST | `/api/auth/forgot-password` | 502 | **BLOCKED** | Mock EMAIL_PROVIDER reports accepted=False by design; no dev_code. Positive run needs real SMTP creds. |
| EP-009 | POST | `/api/auth/reset-password` | None | **BLOCKED** | No dev_code; blocked on EP-008 / real SMTP. |
| EP-010 | POST | `/api/auth/refresh` | 200 | **PASS** | {"access_token": "[REDACTED-TEST-TOKEN]", ...} |
| EP-011 | POST | `/api/auth/google` | 401 | **BLOCKED** | Requires a real provider-issued ID token + JWKS/audience config; dummy token correctly rejected (fail-closed). |
| EP-012 | POST | `/api/auth/apple` | 503 | **BLOCKED** | Requires a real provider-issued ID token + JWKS/audience config; dummy token correctly rejected (fail-closed). |
| EP-013 | GET | `/api/users/me` | 200 | **PASS** | {"user": {"name": "Arkadeep", "email": "arkadeep@admin.com", "phone": "+919000000005", "id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "username": "arkadeep", ... |
| EP-014 | GET | `/api/users/me/profile` | 200 | **PASS** | {"profile": {"name": "Arkadeep", "email": "arkadeep@admin.com", "phone": "+919000000005", "id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "username": "arkadeep... |
| EP-015 | PATCH | `/api/users/me` | 200 | **PASS** | {"user": {"name": "Arkadeep Verified", "email": "arkadeep@admin.com", "phone": "+919000000005", "id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "username": "ar... |
| EP-016 | POST | `/api/users/me/photo` | 200 | **PASS** | {"user_id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "avatar_url": "/uploads/profile_photos/e2d130a038944c9a841cf72c34b018d8.png"} |
| EP-017 | DELETE | `/api/users/me/photo` | 200 | **PASS** | {"user_id": "d9c74850-fd48-5fb3-90de-a2ff974ada46", "avatar_url": null} |
| EP-018 | GET | `/api/users/sessions` | 200 | **PASS** | {"sessions": [{"id": "289e34d8-9fe5-4899-bfad-f840a4a01f20", "device_id": "verify-otp-phone", "device_name": null, "platform": null, "app_version": null, "ex... |
| EP-019 | POST | `/api/users/sessions/4ef38c8e-dc56-4508-a79c-9722f5cb47a8/revoke` | 200 | **PASS** | {"message": "Session revoked."} |
| EP-020 | GET | `/api/users/me/preferences` | 200 | **PASS** | {"currency": "INR", "date_format": "DD/MM/YYYY", "start_of_week": "monday", "app_language": "en", "display_name": "account_name"} |
| EP-021 | PATCH | `/api/users/me/preferences` | 200 | **PASS** | {"currency": "INR", "date_format": "MM/DD/YYYY", "start_of_week": "monday", "app_language": "en", "display_name": "username"} |
| EP-022 | GET | `/api/users/me/notifications/counts` | 200 | **PASS** | {"expense_updates": 1, "settlement_reminders": 1, "group_invitations": 1} |
| EP-023 | GET | `/api/users/me/linked-accounts` | 200 | **PASS** | {"email": {"connected": true, "email": "arkadeep@admin.com", "verified": true}, "phone": {"connected": true, "phone": "+919000000005", "verified": true}, "go... |
| EP-024 | POST | `/api/users/me/linked-accounts/{provider}/link` | 401 | **BLOCKED** | Requires a real Google ID token + configured client IDs; dummy token correctly rejected (fail-closed). No provider secrets in sandbox. |
| EP-025 | DELETE | `/api/users/me/linked-accounts/{provider}/unlink` | 200 | **BLOCKED** | Arkadeep has no google link, so the endpoint correctly refuses; a positive unlink needs a genuinely linked provider (EP-024 blocked). |
| EP-026 | GET | `/api/support/faqs` | 200 | **PASS** | {"faqs": [{"id": "91dc3026-f850-49d2-a477-9de391ad3197", "question": "How do I create a group?", "answer": "Open the Groups tab and tap Create. Give the grou... |
| EP-027 | POST | `/api/support/requests` | 201 | **PASS** | {"id": "79b66b71-cf88-43c1-b8d6-8b4771c98e33", "type": "bug", "subject": "Verification bug report", "description": "Filed while checking POST /api/support/re... |
| EP-028 | GET | `/api/support/requests` | 200 | **PASS** | {"requests": [{"id": "79b66b71-cf88-43c1-b8d6-8b4771c98e33", "type": "bug", "subject": "Verification bug report", "description": "Filed while checking POST /... |
| EP-029 | GET | `/api/invitations/mine` | 200 | **PASS** | {"invitations": [{"id": "8402a663-1759-52b5-b5cc-3088bba11261", "group_name": "Goa Trip 2026", "invite_code": "GOA2026SEED", "invited_by": "Avery Sharma", "s... |
| EP-030 | POST | `/api/invitations` | 200 | **FAIL** | HTTP 200 but no DB effect: create_invitation did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (us... |
| EP-031 | POST | `/api/invitations/8402a663-1759-52b5-b5cc-3088bba11261/accept` | 200 | **FAIL** | HTTP 200 but no DB effect: invitation accept did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (us... |
| EP-032 | POST | `/api/invitations/9447631a-4f02-4c13-ae81-4b2c8be7693f/decline` | 404 | **FAIL** | {"detail": "Invitation not found."} |
| EP-033 | GET | `/api/activities` | 200 | **PASS** | {"items": [{"id": "fbc8deac-ac15-5494-a3ba-9391ea23a25c", "type": "settlement", "title": "Rohan paid you", "subtitle": "Confirmed settlement in Office Lunch ... |
| EP-034 | GET | `/api/activities/fbc8deac-ac15-5494-a3ba-9391ea23a25c` | 200 | **PASS** | {"id": "fbc8deac-ac15-5494-a3ba-9391ea23a25c", "type": "settlement", "title": "Rohan paid you", "subtitle": "Confirmed settlement in Office Lunch Squad", "am... |
| EP-035 | POST | `/api/activities` | 201 | **PASS** | {"id": "3cf6129d-2827-4dcb-8908-8eae2fa0d74a", "type": "expense", "title": "Manual activity", "subtitle": "Created during verification", "amount": "Rs 100", ... |
| EP-036 | GET | `/api/notifications` | 500 | **FAIL** | Backend 500: NotificationItemResponse cannot map the ORM row (id UUID vs str, 'type' not an attribute, 'metadata' vs context_data). |
| EP-037 | GET | `/api/notifications/0b19961a-ae8f-5fb3-82ef-ad23dbd72b9f` | 500 | **FAIL** | Same serializer bug as EP-036. |
| EP-038 | POST | `/api/notifications/0b19961a-ae8f-5fb3-82ef-ad23dbd72b9f/read` | 500 | **FAIL** | Same serializer bug as EP-036. |
| EP-039 | GET | `/api/notifications/unread/count` | 200 | **PASS** | {"unread_count": 3} |
| EP-040 | POST | `/api/groups` | 200 | **PASS** | {"id": "1aed304c-a541-49aa-b64b-8166fd8e8764", "name": "Verification Group", "group_type": "trip", "currency": "INR", "image_url": null, "lifecycle": "active... |
| EP-041 | GET | `/api/groups` | 200 | **PASS** | {"groups": [{"id": "1aed304c-a541-49aa-b64b-8166fd8e8764", "name": "Verification Group", "group_type": "trip", "currency": "INR", "image_url": null, "lifecyc... |
| EP-042 | POST | `/api/groups/join` | 200 | **FAIL** | HTTP 200 but no DB effect: group join did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (use write... |
| EP-043 | GET | `/api/groups/6c8d7670-627c-51bb-a66a-c9c88dc76bac` | 200 | **PASS** | {"id": "6c8d7670-627c-51bb-a66a-c9c88dc76bac", "name": "Office Lunch Squad", "description": "Weekday lunches and coffee runs near the office.", "group_type":... |
| EP-044 | PATCH | `/api/groups/6c8d7670-627c-51bb-a66a-c9c88dc76bac` | 200 | **FAIL** | HTTP 200 but no DB effect: group update did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (use wri... |
| EP-045 | POST | `/api/groups/6c8d7670-627c-51bb-a66a-c9c88dc76bac/members` | 200 | **FAIL** | HTTP 200 but no DB effect: add member did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (use write... |
| EP-046 | DELETE | `/api/groups/d6031203-f6cb-55bb-9c7a-84937346ac39/members/me` | 404 | **FAIL** | {"detail": "Group not found."} |
| EP-047 | POST | `/api/groups/1aed304c-a541-49aa-b64b-8166fd8e8764/archive` | 200 | **FAIL** | HTTP 200 but no DB effect: group archive did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (use wr... |
| EP-048 | POST | `/api/groups/6c8d7670-627c-51bb-a66a-c9c88dc76bac/invite-code/rotate` | 200 | **FAIL** | HTTP 200 but no DB effect: invite-code rotate did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (u... |
| EP-049 | GET | `/api/groups/6c8d7670-627c-51bb-a66a-c9c88dc76bac/suggestions` | 200 | **PASS** | {"group_id": "6c8d7670-627c-51bb-a66a-c9c88dc76bac", "group_name": "Office Lunch Squad", "suggestions": [{"payer_user_id": "3b0ec6ec-55e1-5e88-86f7-f7eb3fa29... |
| EP-050 | GET | `/api/groups/search/by-code` | 404 | **FAIL** | 404 'Invite code is invalid': the EP-048 rotate never persisted, so the code it returned is stale (consequence of the silent-rollback bug). |
| EP-051 | POST | `/api/expenses` | 200 | **FAIL** | HTTP 200 but no DB effect: expense create did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (use w... |
| EP-052 | GET | `/api/expenses` | 200 | **PASS** | {"expenses": [{"id": "e667fbf0-a8a7-5ae7-9713-a6f72ce04799", "group_id": "6c8d7670-627c-51bb-a66a-c9c88dc76bac", "title": "Team lunch", "description": "Lunch... |
| EP-053 | GET | `/api/settlements/people` | 200 | **PASS** | {"people": [{"user_id": "3b0ec6ec-55e1-5e88-86f7-f7eb3fa29671", "display_name": "Priya Nair", "profile_photo": null, "common_group_count": 1, "you_owe": "0.0... |
| EP-054 | GET | `/api/settlements/people/3b0ec6ec-55e1-5e88-86f7-f7eb3fa29671` | 200 | **PASS** | {"user_id": "3b0ec6ec-55e1-5e88-86f7-f7eb3fa29671", "display_name": "Priya Nair", "profile_photo": null, "you_owe": "0.00", "they_owe": "800.00", "net_balanc... |
| EP-055 | GET | `/api/settlements/people/3b0ec6ec-55e1-5e88-86f7-f7eb3fa29671/history` | 200 | **PASS** | {"settlements": [], "total": 0} |
| EP-056 | GET | `/api/settlements/pending-confirmations` | 200 | **PASS** | {"pending": [{"id": "1b2c1738-83f4-57b7-885a-1ce83a42c92f", "group_id": "d6031203-f6cb-55bb-9c7a-84937346ac39", "group_name": "Goa Trip 2026", "payer_user_id... |
| EP-057 | GET | `/api/settlements/groups/6c8d7670-627c-51bb-a66a-c9c88dc76bac/history` | 200 | **PASS** | {"settlements": [{"id": "fae20dcd-0492-526f-9237-64e6b63d3934", "group_id": "6c8d7670-627c-51bb-a66a-c9c88dc76bac", "group_name": "Office Lunch Squad", "paye... |
| EP-058 | POST | `/api/settlements` | 200 | **FAIL** | HTTP 200 but no DB effect: settlement initiate did not persist. Service reads before transaction(); the autobegun session means transaction() never commits (... |
| EP-059 | GET | `/api/settlements/a35ea4fd-6369-4fac-a1ef-d543c8c96477` | 404 | **FAIL** | {"detail": "Settlement not found."} |
| EP-060 | POST | `/api/settlements/a35ea4fd-6369-4fac-a1ef-d543c8c96477/confirm` | 404 | **FAIL** | {"detail": "Settlement not found."} |
| EP-061 | POST | `/api/settlements/e652abfd-fb9c-4722-a8c9-ae16a4d36e2d/reject` | 404 | **FAIL** | {"detail": "Settlement not found."} |
| EP-062 | POST | `/api/settlements/a806b30c-a4e5-4783-bcdc-ec8e57ddb602/cancel` | 404 | **FAIL** | {"detail": "Settlement not found."} |
| EP-063 | GET | `/api/health` | 200 | **PASS** | {"status": "ok", "service": "JodTod API", "version": "v1"} |
| EP-064 | GET | `/` | 200 | **PASS** | {"message": "Welcome to the JodTod Backend!"} |

## DB state verified after the run

- `groups.office_lunch.name_after_EP-044`: Office Lunch Squad (unchanged)
- `groups.office_lunch.invite_code_after_EP-048`: OFFICELSQ01 (unchanged)
- `groups.verification.lifecycle_after_EP-047`: active (not archived)
- `goa_trip.members`: ['avery', 'rohan', 'priya']
- `arkadeep.memberships`: ['office_lunch(admin)', 'Verification Group(admin)']
- `users.name_after_EP-015`: Arkadeep Verified (persisted - control OK)
- `expenses.count`: 7
- `activities.count`: 15
- `support_requests.count`: 4
- `settlements.count`: 4
- `users.count`: 7

Machine-readable: `endpoint_runtime_results.json`.
