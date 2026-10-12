/**
 * Centralized authentication API client.
 *
 * This is the SINGLE layer that talks to authentication endpoints.
 *
 * Screens and React context must never call authentication endpoints
 * directly. They must go through auth.service.ts.
 *
 * Architecture:
 *
 * Screen
 *   ↓
 * AuthContext
 *   ↓
 * auth.service.ts
 *   ↓
 * auth.api.ts
 *   ↓
 * FastAPI backend
 *
 * Backend API base:
 *   API_URL + /api
 *
 * Current authentication routes:
 *   POST /api/auth/signup
 *   POST /api/auth/login
 *   POST /api/auth/google
 *   POST /api/auth/refresh
 *   POST /api/auth/logout
 *   POST /api/auth/send-otp
 *   POST /api/auth/verify-otp
 *   POST /api/auth/verify-email
 *   GET  /api/users/me
 *
 * Refresh architecture:
 * - 401 on an authenticated request triggers one refresh attempt.
 * - Concurrent refresh attempts share a single promise.
 * - The original request is retried only once.
 * - Failed refresh clears persisted authentication state.
 *
 * IMPORTANT:
 * - Never store raw refresh tokens on the backend.
 * - Never log access tokens or refresh tokens.
 * - Never bypass this module with direct fetch() calls from screens.
 */

import {
  API_V1_BASE_URL,
  AUTH_API_PATHS,
  AUTH_TIMEOUTS,
  TOKEN_TYPE_BEARER,
} from "../constants/auth.constants";

import {
  AuthError,
  type AuthErrorCode,
  type AuthResponse,
  type CurrentUserResponse,
  type EmailVerificationResponse,
  type LoginRequest,
  type LoginStatusResponse,
  type LogoutRequest,
  type MessageResponse,
  type OAuthLoginRequest,
  type OTPResponse,
  type RefreshTokenRequest,
  type ResetPasswordRequest,
  type SendOTPRequest,
  type SignupRequest,
  type TokenResponse,
  type VerifyEmailRequest,
  type VerifyOTPRequest,
} from "../types/auth.types";

import {
  clearAuthentication,
  getAuthTokens,
  saveAuthTokens,
} from "./auth.storage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  method: HttpMethod;

  /**
   * Attach:
   *
   * Authorization: Bearer <access-token>
   *
   * when authentication is required.
   */
  authenticated?: boolean;

  body?: unknown;

  /**
   * Internal retry flag.
   *
   * Prevents infinite refresh/retry loops.
   */
  _retried?: boolean;

  timeoutMs?: number;
}

/**
 * Device information required when creating a backend session.
 *
 * device_id is the important field because the backend Session model
 * requires it.
 */
export interface SignupApiInput extends SignupRequest {
  device_id?: string | null;
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------

function toAuthError(
  status: number,
  payload: unknown,
  fallback: string,
): AuthError {
  let detail = fallback;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;

    if (typeof record.detail === "string" && record.detail.trim()) {
      detail = record.detail;
    } else if (typeof record.message === "string" && record.message.trim()) {
      detail = record.message;
    }
  }

  let code: AuthErrorCode = "UNKNOWN";

  if (status === 400) {
    code = "VALIDATION_ERROR";
  } else if (status === 401) {
    code = "UNAUTHORIZED";
  } else if (status === 403) {
    code = "FORBIDDEN";
  } else if (status === 404) {
    code = "NOT_FOUND";
  } else if (status === 409) {
    code = "CONFLICT";
  } else if (status === 422) {
    code = "VALIDATION_ERROR";
  } else if (status === 429) {
    code = "RATE_LIMITED";
  } else if (status >= 500) {
    code = "SERVER_ERROR";
  }

  return new AuthError(detail, code, status);
}

// ---------------------------------------------------------------------------
// Safe JSON parsing
// ---------------------------------------------------------------------------

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    const text = await response.text();

    if (!text) {
      return null;
    }

    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Canceled-request detection
// ---------------------------------------------------------------------------

/**
 * True when a fetch was canceled rather than failed.
 *
 * During cold start / Metro reload on Android, React Native cancels
 * in-flight bootstrap fetches. Hermes surfaces this as a generic
 * `Error: fetch failed: Fetch request has been canceled` — NOT a DOM
 * `AbortError` — so both shapes must be detected.
 *
 * NOTE: our own timeout `AbortController.abort()` also produces an
 * abort-shaped error. Callers track a `timedOut` flag and check it FIRST
 * so a genuine timeout still maps to TIMEOUT, not REQUEST_CANCELLED.
 */
export function isRequestCanceled(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = (error as { name?: unknown }).name;

  if (typeof name === "string" && name === "AbortError") {
    return true;
  }

  const message = (error as { message?: unknown }).message;

  if (typeof message === "string") {
    const lower = message.toLowerCase();

    if (
      lower.includes("canceled") ||
      lower.includes("cancelled") ||
      lower.includes("aborted")
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Refresh handling
// ---------------------------------------------------------------------------

let inFlightRefresh: Promise<TokenResponse> | null = null;

function isRefreshPath(path: string): boolean {
  return path === AUTH_API_PATHS.REFRESH;
}

/**
 * Perform one refresh request.
 *
 * IMPORTANT:
 * The refresh endpoint does not receive an Authorization header.
 * It receives the refresh token in the request body.
 */
async function performRefresh(refreshToken: string): Promise<TokenResponse> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AUTH_TIMEOUTS.REFRESH_TIMEOUT_MS);

  try {
    const body: RefreshTokenRequest = {
      refresh_token: refreshToken,
    };

    const response = await fetch(
      `${API_V1_BASE_URL}${AUTH_API_PATHS.REFRESH}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      throw toAuthError(response.status, payload, "Session refresh failed.");
    }

    /**
     * Backend may return:
     *
     * {
     *   access_token,
     *   refresh_token,
     *   ...
     * }
     *
     * or:
     *
     * {
     *   tokens: {
     *     access_token,
     *     refresh_token,
     *     ...
     *   }
     * }
     */
    const parsed = payload as
      | TokenResponse
      | {
          tokens?: TokenResponse;
        };

    const normalized =
      "tokens" in parsed && parsed.tokens
        ? parsed.tokens
        : (parsed as TokenResponse);

    if (!normalized?.access_token || !normalized?.refresh_token) {
      throw new AuthError("Session refresh failed.", "SESSION_EXPIRED", 401);
    }

    await saveAuthTokens({
      accessToken: normalized.access_token,
      refreshToken: normalized.refresh_token,
      sessionId: normalized.session_id ?? null,
    });

    return normalized;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    if (
      timedOut ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new AuthError("Session refresh timed out.", "TIMEOUT");
    }

    if (isRequestCanceled(error)) {
      if (__DEV__) {
        console.warn(
          "[auth.api] refresh request canceled (bundle reload?), ignoring.",
        );
      }
      throw new AuthError(
        "The request was canceled. Please try again.",
        "REQUEST_CANCELLED",
      );
    }

    throw new AuthError(
      "Could not reach the authentication server. Check your connection and that the backend is running.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Single-flight refresh.
 *
 * If multiple requests receive 401 simultaneously,
 * only ONE refresh request is sent.
 */
export async function refreshTokensWithDedup(
  refreshToken: string,
): Promise<TokenResponse> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh(refreshToken).finally(() => {
      inFlightRefresh = null;
    });
  }

  try {
    return await inFlightRefresh;
  } catch (error) {
    // Transient bundle-reload cancelation must not wipe the stored session.
    if (error instanceof AuthError && error.code === "REQUEST_CANCELLED") {
      throw error;
    }

    await clearAuthentication();

    if (error instanceof AuthError) {
      if (error.code === "UNAUTHORIZED" || error.code === "UNKNOWN") {
        throw new AuthError(
          "Your session has expired. Please log in again.",
          "SESSION_EXPIRED",
          401,
        );
      }

      throw error;
    }

    throw new AuthError(
      "Your session has expired. Please log in again.",
      "SESSION_EXPIRED",
      401,
    );
  }
}

// ---------------------------------------------------------------------------
// Core authentication request
// ---------------------------------------------------------------------------

async function authRequest<T>(
  path: string,
  options: RequestOptions,
): Promise<T> {
  const {
    method,
    authenticated = false,
    body,
    _retried = false,
    timeoutMs,
  } = options;

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    timeoutMs ?? AUTH_TIMEOUTS.REQUEST_TIMEOUT_MS,
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // ---------------------------------------------------------
  // Authorization
  // ---------------------------------------------------------

  if (authenticated && !isRefreshPath(path)) {
    const tokens = await getAuthTokens();

    if (tokens.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_V1_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      timedOut ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw new AuthError(
        "The request timed out. Please try again.",
        "TIMEOUT",
      );
    }

    if (isRequestCanceled(error)) {
      if (__DEV__) {
        console.warn(
          "[auth.api] request canceled (bundle reload?), ignoring.",
        );
      } else {
        console.warn("[auth.api] request canceled.");
      }
      throw new AuthError(
        "The request was canceled. Please try again.",
        "REQUEST_CANCELLED",
      );
    }

    // Single dev-only diagnostic: the AuthError thrown below already
    // carries NETWORK_ERROR to the UI. Never log request bodies/tokens.
    if (__DEV__) {
      console.warn('[auth.api] network error:', path, method);
    }

    throw new AuthError(
      "Could not reach the authentication server. Check your connection and that the backend is running.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }

  // ---------------------------------------------------------
  // Automatic access-token refresh
  // ---------------------------------------------------------

  if (
    response.status === 401 &&
    authenticated &&
    !_retried &&
    !isRefreshPath(path)
  ) {
    const stored = await getAuthTokens();

    if (stored.refreshToken) {
      await refreshTokensWithDedup(stored.refreshToken);

      return authRequest<T>(path, {
        ...options,
        _retried: true,
      });
    }

    await clearAuthentication();

    throw new AuthError(
      "Your session has expired. Please log in again.",
      "SESSION_EXPIRED",
      401,
    );
  }

  // ---------------------------------------------------------
  // Response handling
  // ---------------------------------------------------------

  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    // Single dev-only diagnostic per failed request (path + status only —
    // never payloads, tokens, or headers). Expected user errors such as
    // invalid login credentials stay out of release logs entirely.
    if (__DEV__) {
      console.warn('[auth.api] request failed:', method, path, response.status);
    }

    /**
     * Login gets a UI-friendly invalid-credentials error.
     */
    if (response.status === 401 && path === AUTH_API_PATHS.LOGIN) {
      const generic = toAuthError(
        response.status,
        payload,
        "Invalid email/phone or password.",
      );

      throw new AuthError(generic.message, "INVALID_CREDENTIALS", 401);
    }

    throw toAuthError(
      response.status,
      payload,
      "Authentication request failed.",
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Authentication response normalization
// ---------------------------------------------------------------------------

function normalizeAuthResponse(
  payload: AuthResponse | TokenResponse,
): AuthResponse {
  if ((payload as AuthResponse).user && (payload as AuthResponse).tokens) {
    return payload as AuthResponse;
  }

  throw new AuthError(
    "Unexpected authentication response from server.",
    "SERVER_ERROR",
  );
}

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

/**
 * Create a new account.
 *
 * Backend endpoint:
 *
 * POST /api/auth/signup
 *
 * The service layer is responsible for resolving the device ID.
 * This function only sends the already-resolved request to the backend.
 */
export async function apiSignup(input: SignupApiInput): Promise<AuthResponse> {
  const payload = await authRequest<AuthResponse>(AUTH_API_PATHS.SIGNUP, {
    method: "POST",
    body: input,
  });

  return normalizeAuthResponse(payload);
}

// ---------------------------------------------------------------------------
// Login (two-step: credentials -> pending OTP -> verify-otp opens session)
// ---------------------------------------------------------------------------

function isAuthResponse(payload: unknown): payload is AuthResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "user" in payload &&
    "tokens" in payload
  );
}

export async function apiLogin(
  input: LoginRequest,
): Promise<AuthResponse | LoginStatusResponse> {
  const payload = await authRequest<AuthResponse | LoginStatusResponse>(
    AUTH_API_PATHS.LOGIN,
    {
      method: "POST",
      body: input,
    },
  );

  if (isAuthResponse(payload) || payload?.status === "otp_required") {
    return payload;
  }

  throw new AuthError(
    "Unexpected authentication response from server.",
    "SERVER_ERROR",
  );
}

// ---------------------------------------------------------------------------
// Google OAuth
// ---------------------------------------------------------------------------

export async function apiLoginWithGoogle(
  input: Omit<OAuthLoginRequest, "provider">,
): Promise<AuthResponse> {
  const payload = await authRequest<AuthResponse>(AUTH_API_PATHS.GOOGLE, {
    method: "POST",
    body: input,
  });

  return normalizeAuthResponse(payload);
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export async function apiRefresh(refreshToken: string): Promise<TokenResponse> {
  return refreshTokensWithDedup(refreshToken);
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function apiLogout(input?: LogoutRequest): Promise<void> {
  const tokens = await getAuthTokens();

  const body: LogoutRequest = {
    session_id: input?.session_id ?? tokens.sessionId ?? undefined,
  };

  try {
    await authRequest<unknown>(AUTH_API_PATHS.LOGOUT, {
      method: "POST",
      authenticated: true,
      body,
    });
  } catch {
    /**
     * Logout remains best-effort.
     *
     * auth.service.ts always clears local authentication
     * regardless of backend availability.
     */
  }
}

// ---------------------------------------------------------------------------
// Current user
// ---------------------------------------------------------------------------

export async function apiGetCurrentUser(): Promise<CurrentUserResponse> {
  return authRequest<CurrentUserResponse>(AUTH_API_PATHS.CURRENT_USER, {
    method: "GET",
    authenticated: true,
  });
}

// ---------------------------------------------------------------------------
// OTP
// ---------------------------------------------------------------------------

export async function apiSendOTP(input: SendOTPRequest): Promise<OTPResponse> {
  return authRequest<OTPResponse>(AUTH_API_PATHS.SEND_OTP, {
    method: "POST",
    body: input,
  });
}

export async function apiSendEmailVerification(email: string): Promise<OTPResponse> {
  return authRequest<OTPResponse>(AUTH_API_PATHS.SEND_EMAIL_VERIFICATION, {
    method: "POST",
    body: { email },
  });
}

export async function apiVerifyOTP(
  input: VerifyOTPRequest,
): Promise<AuthResponse | OTPResponse> {
  const payload = await authRequest<AuthResponse | OTPResponse>(
    AUTH_API_PATHS.VERIFY_OTP,
    {
      method: "POST",
      body: input,
    },
  );

  // Login purposes (email_login / phone_login) return a full AuthResponse
  // with fresh tokens; all other purposes return an OTPResponse.
  return isAuthResponse(payload) ? payload : (payload as OTPResponse);
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function apiVerifyEmail(
  input: VerifyEmailRequest,
): Promise<EmailVerificationResponse> {
  return authRequest<EmailVerificationResponse>(AUTH_API_PATHS.VERIFY_EMAIL, {
    method: "POST",
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function apiForgotPassword(
  identifier: string,
): Promise<MessageResponse> {
  return authRequest<MessageResponse>(AUTH_API_PATHS.FORGOT_PASSWORD, {
    method: "POST",
    body: { identifier },
  });
}

export async function apiResetPassword(
  input: ResetPasswordRequest,
): Promise<MessageResponse> {
  return authRequest<MessageResponse>(AUTH_API_PATHS.RESET_PASSWORD, {
    method: "POST",
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Authorized fetch for non-auth API services
// ---------------------------------------------------------------------------

export interface AuthorizedFetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Internal retry guard — prevents refresh/retry loops. */
  _retried?: boolean;
  /**
   * When false the request is sent without an Authorization header and
   * a 401 is returned to the caller instead of triggering a refresh.
   * Used for endpoints that are public but still benefit from the
   * shared timeout handling.
   */
  authenticated?: boolean;
}

/**
 * Single request path for the non-authentication API services.
 *
 * Every service (profile, preferences, activity, support, linked
 * accounts) needs the same three things, and previously re-implemented
 * them by hand:
 *
 * 1. the Bearer token from the shared token store,
 * 2. a timeout so a hung request rejects instead of spinning forever,
 * 3. a single refresh + one retry when the access token has expired.
 *
 * This reuses the existing single-flight refresh above, so concurrent
 * 401s across screens still collapse into one refresh request.
 *
 * It returns the raw Response: each service keeps its own typed error
 * class and `parseError` handling, so error messages shown to the user
 * are unchanged.
 */
export async function authorizedFetch(
  path: string,
  options: AuthorizedFetchOptions = {},
): Promise<Response> {
  const {
    method = "GET",
    body,
    headers: extraHeaders,
    timeoutMs,
    _retried = false,
    authenticated = true,
  } = options;

  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(
    () => {
      timedOut = true;
      controller.abort();
    },
    timeoutMs ?? AUTH_TIMEOUTS.REQUEST_TIMEOUT_MS,
  );

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  try {
    if (authenticated) {
      const authHeaders = await getAuthorizationHeader();
      Object.assign(headers, authHeaders);
    }

    const response = await fetch(`${API_V1_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    /**
     * Expired access token: refresh once (deduplicated), then replay the
     * request exactly once.
     */
    if (response.status === 401 && authenticated && !_retried) {
      const stored = await getAuthTokens();

      if (stored.refreshToken) {
        await refreshTokensWithDedup(stored.refreshToken);

        return authorizedFetch(path, { ...options, _retried: true });
      }

      await clearAuthentication();
    }

    return response;
  } catch (error) {
    if (timedOut) {
      throw new AuthError(
        "The request timed out. Please try again.",
        "TIMEOUT",
      );
    }

    if (isRequestCanceled(error)) {
      throw new AuthError(
        "The request was canceled. Please try again.",
        "REQUEST_CANCELLED",
      );
    }

    throw new AuthError(
      "Could not reach the server. Check your connection and try again.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Authorization helper
// ---------------------------------------------------------------------------

/**
 * Authorization header helper for non-authenticated API modules.
 *
 * Other API services should reuse this instead of implementing their
 * own token-reading logic.
 */
export async function getAuthorizationHeader(): Promise<
  Record<string, string>
> {
  const tokens = await getAuthTokens();

  if (!tokens.accessToken) {
    return {};
  }

  const type = TOKEN_TYPE_BEARER;

  return {
    Authorization:
      `${type.charAt(0).toUpperCase()}${type.slice(1)} ` + tokens.accessToken,
  };
}
