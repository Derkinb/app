import Constants from 'expo-constants';
import { Platform } from 'react-native';

// WEB -> backend na localhost:4000
// ANDROID (emulator) -> 10.0.2.2:4000
// ANDROID (fizyczny telefon w tej samej sieci) -> wpisz IP komputera, np. http://192.168.0.10:4000
const DEV_WEB = 'http://localhost:4000';
const DEV_ANDROID = 'http://10.0.2.2:4000';

const devDefaultUrl = Platform.OS === 'web' ? DEV_WEB : DEV_ANDROID;

const expoExtras =
  Constants?.expoConfig?.extra ??
  Constants?.expoConfig?.expoGo?.extra ??
  Constants?.manifest2?.extra ??
  Constants?.manifest?.extra ??
  {};

const explicitUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.API_URL ??
  expoExtras.apiUrl ??
  expoExtras.API_URL ??
  expoExtras.backendUrl ??
  expoExtras.backendURL ??
  null;

function normaliseUrl(url) {
  if (!url) {
    return null;
  }
  return url.replace(/\/+$/, '');
}

function extractHostCandidate() {
  const candidates = [
    Constants?.expoConfig?.hostUri,
    Constants?.expoConfig?.debuggerHost,
    Constants?.manifest2?.extra?.expoGo?.developer?.url,
    Constants?.manifest?.hostUri,
    Constants?.manifest?.debuggerHost,
    Constants?.expoGoConfig?.hostUri
  ];

  for (const value of candidates) {
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }

    const withoutProtocol = value.replace(/^(https?:\/\/)/, '');
    const [hostPart] = withoutProtocol.split(/[/?#]/);
    if (!hostPart) {
      continue;
    }

    const [hostname] = hostPart.split(':');
    if (hostname) {
      return hostname;
    }
  }

  return null;
}

function buildUrlFromHost(host) {
  if (!host) {
    return null;
  }

  try {
    const base = new URL(devDefaultUrl);
    const portSegment = base.port ? `:${base.port}` : '';
    return `${base.protocol}//${host}${portSegment}`;
  } catch (error) {
    // W razie problemów z parsowaniem URL korzystamy z domyślnych wartości dev.
    const fallback = normaliseUrl(devDefaultUrl);
    return fallback ?? null;
  }
}

const hostFromExpo = buildUrlFromHost(extractHostCandidate());

const resolvedApiUrl = normaliseUrl(explicitUrl ?? hostFromExpo ?? devDefaultUrl);

if (!explicitUrl) {
  console.warn(
    '[config] API_URL nie zostało skonfigurowane. Korzystam z adresu domyślnego',
    resolvedApiUrl
  );
}

export const API_URL = resolvedApiUrl;
