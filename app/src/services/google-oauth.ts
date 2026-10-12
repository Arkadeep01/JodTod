/**
 * Google OAuth configuration for JodTod — single source of truth.
 *
 * This exists because the previous implementation resolved the OAuth
 * client and redirect implicitly, and both resolutions were wrong:
 *
 *  1. NO `redirectUri` was passed to `Google.useIdTokenAuthRequest`, so
 *     expo-auth-session fell back to `makeRedirectUri()`. That helper is
 *     environment-dependent by design (SDK 57 docs):
 *
 *        makeRedirectUri({ scheme, path })
 *          Development Build -> my-scheme://redirect
 *          Expo Go           -> exp://127.0.0.1:8081/--/redirect
 *
 *     In Expo Go the packager's LAN address was therefore sent to Google
 *     as the redirect, producing `Error 400: invalid_request`
 *     ("Access blocked: Authorization Error").
 *
 *  2. `app.json` had no `googleAndroidClientId`, and the code fell back
 *     to the WEB client ID for Android. expo-auth-session picks the
 *     client by platform (`android -> androidClientId`), so a Web-type
 *     client was combined with a custom-scheme redirect — a combination
 *     Google rejects outright. A Web client only accepts http(s)
 *     redirect URIs; a custom scheme requires an Android client.
 *
 * Fixes enforced here:
 *  - The redirect URI is DETERMINISTIC and derived from the app's own
 *    configured scheme (`app.json -> expo.scheme`). It never depends on
 *    the packager host, a LAN IP, or the build flavour.
 *  - The client ID is resolved per platform and is NEVER substituted
 *    across client types.
 *  - The three build environments (Expo Go / development build /
 *    production) are distinguished explicitly. A custom-scheme redirect
 *    cannot be delivered by Expo Go, so that case is reported as a
 *    controlled, actionable state instead of hanging on "Connecting...".
 *
 * No client secret is present here or anywhere in the app: Google
 * client secrets are backend-only (`backend/.env`), and the mobile app
 * only ever receives a Google-issued ID token, which the backend
 * verifies server-side.
 */

import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

/** Path appended to the app scheme: jodtod://oauth */
const REDIRECT_PATH = "oauth";

type ExtraConfig = {
  // Typed unknown: Expo's config pipeline materializes null extra values
  // as {} on device, so readers must never assume strings here.
  googleWebClientId?: unknown;
  googleAndroidClientId?: unknown;
};

export type GoogleOAuthEnvironment =
  | "expo-go"
  | "development-build"
  | "production";

function extraConfig(): ExtraConfig {
  return (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
}

function trimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

/**
 * True when the JS bundle runs inside the Expo Go client.
 *
 * `Constants.executionEnvironment` reports `storeClient` for BOTH Expo
 * Go and `expo-dev-client` development builds in SDK 57, so it cannot
 * separate them. `expoGoConfig` is only populated by Expo Go, which is
 * the reliable signal; `appOwnership` is kept as a secondary check.
 */
export function isExpoGo(): boolean {
  if (Constants.expoGoConfig != null) return true;
  return Constants.appOwnership === "expo";
}

/**
 * Which build is running. Development build vs production cannot be
 * distinguished from a managed build's runtime constants, so both are
 * reported as their own environment and share the same redirect.
 */
export function googleOAuthEnvironment(): GoogleOAuthEnvironment {
  if (isExpoGo()) return "expo-go";
  if (Constants.executionEnvironment === "standalone") return "production";
  return "development-build";
}

/** The app's own URI scheme, from app.json `expo.scheme`. */
export function googleAppScheme(): string | undefined {
  // ExpoConfig.scheme is typed `string | string[]`; a multi-scheme app
  // uses the first entry.
  const scheme = Constants.expoConfig?.scheme;
  const first = Array.isArray(scheme) ? scheme[0] : scheme;
  return trimmed(first) ?? trimmed(Linking.createURL("/").split("://")[0]);
}

/**
 * The redirect URI sent to Google.
 *
 * Deterministic on every environment: `jodtod://oauth` for Expo Go,
 * development builds and production alike. On web the app is served
 * over http(s), so the platform default applies there instead.
 */
export function googleRedirectUri(): string {
  if (Platform.OS === "web") {
    return Linking.createURL(REDIRECT_PATH);
  }
  const scheme = googleAppScheme() ?? "jodtod";
  return `${scheme}://${REDIRECT_PATH}`;
}

/**
 * The Google client ID used by the Android app.
 *
 * JodTod is an Android-only application, so there is exactly one mobile
 * client: the Android OAuth client. The Web client in app.json belongs
 * to the backend/web flow and is NEVER substituted here — doing so is
 * what produced "Error 400: invalid_request" (a Web client cannot be
 * registered for a custom scheme such as jodtod://oauth).
 */
export function googleClientId(): string | undefined {
  const extra = extraConfig();
  if (Platform.OS === "web") return trimmed(extra.googleWebClientId);
  return trimmed(extra.googleAndroidClientId);
}

/**
 * A user-safe reason this build cannot complete Google linking, or null
 * when it can. Messages never expose client IDs, redirect internals,
 * codes or tokens.
 */
export function googleOAuthBlockedReason(): string | null {
  if (isExpoGo()) {
    return "Google linking needs a development build. Reopen JodTod in the dev client, then try again.";
  }
  if (!googleClientId()) {
    return "Google connection is not set up in this build yet.";
  }
  return null;
}

/** True when a Connect action can actually be attempted. */
export function isGoogleOAuthAvailable(): boolean {
  return googleOAuthBlockedReason() === null;
}
