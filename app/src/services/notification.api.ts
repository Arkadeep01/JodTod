/**
 * Notification API client.
 *
 * Single layer that talks to the Notification endpoints.
 * Screens must use these helpers instead of calling the endpoints directly.
 *
 * Backend routes (see backend/routes/notifications.py):
 *   GET  /api/notifications
 *   GET  /api/notifications/{notification_id}
 *   POST /api/notifications/{notification_id}/read
 *   GET  /api/notifications/unread/count
 *
 * Auth reuses the sanctioned helper from auth.api.ts
 * (getAuthorizationHeader) so token handling stays in one place.
 */

import { API_V1_BASE_URL } from "../constants/auth.constants";
import { getAuthorizationHeader } from "./auth.api";

export type NotificationType =
  | "expense_added"
  | "settlement_completed"
  | "group_invitation"
  | "group_comment"
  | "trip_report_ready"
  | "budget_alert"
  | "member_joined_group"
  | "bill_image_updated"
  | "group_settings_updated"
  | "system";

export interface BackendNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  related_group_id: string | null;
  related_expense_id: string | null;
  related_settlement_id: string | null;
  related_user_id: string | null;
  attachment_reference: string | null;
  metadata: Record<string, unknown> | null;
}

export interface FetchNotificationsParams {
  type?: NotificationType;
  read?: "unread" | "read" | "all";
  limit?: number;
}

export class NotificationApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "NotificationApiError";
    this.status = status;
  }
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string" && body.detail) {
      return `: ${body.detail}`;
    }
  } catch {
    // Non-JSON error body — the status code alone will have to do.
  }
  return "";
}

export async function fetchNotifications(
  params: FetchNotificationsParams = {},
): Promise<BackendNotification[]> {
  const headers = await getAuthorizationHeader();
  // Only send params the caller actually set. The backend treats a
  // present-but-empty `type` as an unsupported-type value (400) rather
  // than "no filter", so unconditionally sending `type=` broke the
  // default "All" list on every load.
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  if (params.read && params.read !== "all") search.set("read", params.read);
  if (params.limit) search.set("limit", String(params.limit));

  const query = search.toString();
  const url =
    query.length > 0
      ? `${API_V1_BASE_URL}/notifications?${query}`
      : `${API_V1_BASE_URL}/notifications`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    throw new NotificationApiError(
      error instanceof Error ? error.message : "Network request failed.",
      null,
    );
  }

  if (!response.ok) {
    throw new NotificationApiError(
      `Notification request failed with status ${response.status}${await errorDetail(response)}.`,
      response.status,
    );
  }

  const body = (await response.json()) as { items: BackendNotification[] };
  return Array.isArray(body.items) ? body.items : [];
}

export async function fetchNotificationById(
  id: string,
): Promise<BackendNotification> {
  const headers = await getAuthorizationHeader();
  let response: Response;
  try {
    response = await fetch(`${API_V1_BASE_URL}/notifications/${id}`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    throw new NotificationApiError(
      error instanceof Error ? error.message : "Network request failed.",
      null,
    );
  }

  if (!response.ok) {
    throw new NotificationApiError(
      `Notification detail request failed with status ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as BackendNotification;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<BackendNotification> {
  const headers = await getAuthorizationHeader();
  let response: Response;
  try {
    response = await fetch(
      `${API_V1_BASE_URL}/notifications/${notificationId}/read`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    throw new NotificationApiError(
      error instanceof Error ? error.message : "Network request failed.",
      null,
    );
  }

  if (!response.ok) {
    throw new NotificationApiError(
      `Mark notification as read failed with status ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as BackendNotification;
}

export async function fetchUnreadCount(): Promise<{
  unread_count: number;
}> {
  const headers = await getAuthorizationHeader();
  let response: Response;
  try {
    response = await fetch(`${API_V1_BASE_URL}/notifications/unread/count`, {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    throw new NotificationApiError(
      error instanceof Error ? error.message : "Network request failed.",
      null,
    );
  }

  if (!response.ok) {
    throw new NotificationApiError(
      `Unread count request failed with status ${response.status}.`,
      response.status,
    );
  }

  return (await response.json()) as {
    unread_count: number;
  };
}