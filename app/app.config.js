/** @type {import('expo/config').ExpoConfig} */

// Optional native Android Google client id. Empty/missing => null (never {}).
// Kept as a plain string lookup so `npx expo config` serializes to null,
// not an object, when the env var is unset.
const googleAndroidClientId =
  (typeof process !== 'undefined' && process.env?.GOOGLE_ANDROID_CLIENT_ID
    ? String(process.env.GOOGLE_ANDROID_CLIENT_ID)
    : ''
  ).trim() || null;

const config = {
  name: 'JodTod',
  slug: 'jodtod',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'jodtod',
  userInterfaceStyle: 'automatic',
  android: {
    predictiveBackGestureEnabled: false,
    package: 'com.anonymous.app',
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  plugins: [
    'expo-image',
    [
      'expo-image-picker',
      {
        photosPermission: 'JodTod needs access to your photos so you can set a profile picture.',
        cameraPermission: 'JodTod needs access to your camera so you can take a profile picture.',
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'JodTod needs access to your camera so you can scan group invite codes.',
      },
    ],
    'expo-router',
    'expo-asset',
    'expo-secure-store',
    'expo-splash-screen',
    'expo-web-browser',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  extra: {
    router: {},
    googleWebClientId: '491126960792-69bdj4155d3681ktsaqjp4j7h69cge5n.apps.googleusercontent.com',
    // NOTE: omitted entirely when unset. Expo's config pipeline materializes
    // null extra values as {} on device, which readers must treat as "unset"
    // (see trimmedExtraString in src/services/google-oauth.ts). Spreading a
    // conditional keeps the key absent instead of null.
    ...(googleAndroidClientId ? { googleAndroidClientId } : {}),
    eas: {
      projectId: '6b8c4717-46de-4342-8318-3d5b3308660e',
    },
  },
};

export default config;