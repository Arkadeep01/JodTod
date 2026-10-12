import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

/**
 * Backend base URL resolution.
 *
 * Rules:
 * - No LAN IP is ever hardcoded. A DHCP lease changes, and a baked-in
 *   address silently points a physical device at the wrong host. The dev
 *   host is always read from the Metro/Expo host URI at runtime.
 * - An explicit EXPO_PUBLIC_API_URL (see app/.env.example) always wins
 *   when it is a valid http(s) origin — in dev AND in release builds.
 * - Expo tunnel mode (`expo start --tunnel`) forwards ONLY the Metro
 *   bundler port, never the API port, so a host derived from a tunnel
 *   URL (e.g. `xyz.exp.direct:443` -> `http://xyz.exp.direct:5001`)
 *   would point at nothing. Tunnel hosts are therefore rejected and the
 *   explicit EXPO_PUBLIC_API_URL is required instead.
 * - Production is driven by EXPO_PUBLIC_API_URL. When it is missing the
 *   misconfiguration is reported through `apiConfigurationError` instead
 *   of being hidden behind a placeholder domain that would 404 at runtime.
 */

const API_PORT = '5001';

function isValidHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Strip trailing slashes so `${API_URL}/api/...` never gets `//`. */
function normalizeConfiguredUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * The production API origin, e.g. `https://api.jodtod.com`.
 *
 * Set EXPO_PUBLIC_API_URL in app/.env (see app/.env.example). The value
 * must be the scheme + host only — no trailing /api, no trailing slash.
 */
const CONFIGURED_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();

/**
 * Host substrings that identify an Expo/network tunnel endpoint. A tunnel
 * forwards the Metro bundler port only — appending the API port to one of
 * these hosts never reaches the backend.
 */
const TUNNEL_HOST_PATTERNS = [
  'exp.direct',
  '.ngrok.io',
  '.ngrok-free.app',
  '.ngrok.app',
  '.trycloudflare.com',
  '.loca.lt',
  '.tunnel.',
];

function isTunnelHost(hostPort: string): boolean {
  const lower = hostPort.toLowerCase();
  return TUNNEL_HOST_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Raw Metro/Expo host URI (e.g. `192.168.1.5:8081`), or null. */
function rawHostUri(): string | null {
  try {
    const hostUri: unknown =
      Constants.expoConfig?.hostUri ??
      (
        Constants as unknown as {
          manifest2?: { extra?: { expoClient?: { hostUri?: unknown } } };
        }
      ).manifest2?.extra?.expoClient?.hostUri;

    if (typeof hostUri !== 'string' || !hostUri.trim()) return null;
    return hostUri.trim();
  } catch {
    return null;
  }
}

/**
 * True when the app is served over an Expo tunnel. Exported so UI can
 * explain backend failures (tunnel => set EXPO_PUBLIC_API_URL) instead of
 * showing a generic offline banner.
 */
export const isExpoTunnel: boolean = (() => {
  const raw = rawHostUri();
  if (!raw) return false;
  const noScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostPort = (noScheme.split('/')[0] ?? '').trim();
  return !!hostPort && isTunnelHost(hostPort);
})();

/**
 * Resolve the dev-server host from the Expo host URI (e.g.
 * `192.168.1.5:8081` -> `192.168.1.5`).
 *
 * Returns null for Expo Go tunnels (see TUNNEL_HOST_PATTERNS),
 * unbracketed IPv6 hosts (port ambiguous), loopback, and manifests that
 * do not expose a host — all cases where `http://<host>:5001` would be a
 * lie. Callers must fall back to EXPO_PUBLIC_API_URL instead.
 */
function devServerIp(): string | null {
  const raw = rawHostUri();
  if (!raw) return null;

  // Strip scheme (exp://, http://) and any path/query.
  const noScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const hostPort = (noScheme.split('/')[0] ?? '').trim();
  if (!hostPort) return null;

  // Tunnel hosts never expose the API port.
  if (isTunnelHost(hostPort)) return null;

  // Bracketed IPv6: [fe80::1]:8081 -> fe80::1 (re-bracketed on build).
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']');
    if (close <= 1) return null;
    const host = hostPort.slice(1, close).trim();
    if (!host || host === '::1') return null;
    return `[${host}]`;
  }

  // More than one colon without brackets = bare IPv6 (port ambiguous).
  if (hostPort.split(':').length > 2) return null;

  const host = (hostPort.split(':')[0] ?? '').trim();

  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;

  return host;
}

/**
 * Android emulator reaches the host machine through 10.0.2.2.
 */
function androidEmulatorBaseUrl(): string | null {
  if (Platform.OS !== 'android') return null;
  if (Device.isDevice) return null;
  return `http://10.0.2.2:${API_PORT}`;
}

function devBaseUrl(): string | null {
  const emulator = androidEmulatorBaseUrl();
  if (emulator) return emulator;

  const host = devServerIp();
  if (host) return `http://${host}:${API_PORT}`;

  return null;
}

function resolveApiUrl(): string {
  if (__DEV__) {
    // Explicit override wins in dev: required for tunnel mode, handy for
    // forcing a specific backend on LAN.
    if (CONFIGURED_API_URL && isValidHttpUrl(CONFIGURED_API_URL)) {
      return normalizeConfiguredUrl(CONFIGURED_API_URL);
    }
    const dev = devBaseUrl();
    if (dev) return dev;
    return `http://localhost:${API_PORT}`;
  }

  return CONFIGURED_API_URL;
}

/**
 * Non-null when the API base URL could not be resolved.
 *
 * The app stays usable (the auth gate and error states render) and the
 * request layer surfaces this instead of firing requests at a host that
 * does not exist.
 */
export const apiConfigurationError: string | null = (() => {
  if (CONFIGURED_API_URL) {
    if (!isValidHttpUrl(CONFIGURED_API_URL)) {
      return `EXPO_PUBLIC_API_URL must start with http:// or https:// (received "${CONFIGURED_API_URL}").`;
    }
    return null;
  }

  if (!__DEV__) {
    return 'EXPO_PUBLIC_API_URL is not set. Add it to app/.env so release builds reach the JodTod API.';
  }

  if (isExpoTunnel) {
    return 'Expo tunnel detected: the tunnel forwards only Metro, not the API port. Set EXPO_PUBLIC_API_URL in app/.env to a reachable backend (e.g. http://192.168.1.100:5001), or run "expo start --lan" with phone + laptop on the same Wi-Fi.';
  }

  if (!devBaseUrl()) {
    return 'Could not resolve the Expo dev-server host. Start the app through "expo start" or set EXPO_PUBLIC_API_URL explicitly.';
  }

  return null;
})();

export const API_URL = resolveApiUrl();
