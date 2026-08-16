import type { ConfigContext, ExpoConfig } from 'expo/config';

const allowCleartextTraffic = process.env.APP_ALLOW_CLEARTEXT_HTTP === 'true';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'LecPunch',
  slug: 'lecpunch',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/lec-icon.png',
  scheme: 'lecpunch',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.lecpunch.app',
    versionCode: 2,
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/images/lec-adaptive-foreground.png',
      backgroundImage: './assets/images/lec-adaptive-background.png',
      monochromeImage: './assets/images/lec-adaptive-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  extra: {
    eas: {
      projectId: '8fa8bb01-9a9e-4e5d-9180-64de151740a9',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: allowCleartextTraffic,
        },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/images/lec-adaptive-monochrome.png',
        color: '#2563EB',
        defaultChannel: 'checkin-reminders',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#F7F9FC',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
