import Constants from 'expo-constants';
import { Platform } from 'react-native';

// WEB -> backend na localhost:4000
// ANDROID (emulator) -> 10.0.2.2:4000
// ANDROID (fizyczny telefon w tej samej sieci) -> wpisz IP komputera, np. http://192.168.0.10:4000
const DEV_WEB = 'http://localhost:4000';
const DEV_ANDROID = 'http://10.0.2.2:4000';

const devDefaultUrl = Platform.OS === 'web' ? DEV_WEB : DEV_ANDROID;

const getConfiguredApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const extra =
    Constants?.expoConfig?.extra ??
    Constants?.manifest2?.extra ??
    Constants?.manifest?.extra;

  if (extra?.apiUrl) {
    return extra.apiUrl;
  }

  return undefined;
};

const getFallbackApiUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return devDefaultUrl;
};

const configuredApiUrl = getConfiguredApiUrl();
const fallbackApiUrl = configuredApiUrl ? null : getFallbackApiUrl();

if (!configuredApiUrl && fallbackApiUrl) {
  const fallbackSource =
    fallbackApiUrl === devDefaultUrl ? 'default development URL' : 'window.location.origin';
  console.warn(
    `[config] API_URL fallback (${fallbackSource}). Ustaw zmienną EXPO_PUBLIC_API_URL lub extra.apiUrl jeśli to niezamierzone.`,
  );
}

export const API_URL = configuredApiUrl ?? fallbackApiUrl ?? devDefaultUrl;
