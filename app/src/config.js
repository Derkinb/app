import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants?.expoConfig?.extra ?? {};
const explicitUrl =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  extra.apiUrl ||
  null;

const hostFromExpo = Constants?.expoConfig?.hostUri
  ? Constants.expoConfig.hostUri.split(':')[0]
  : null;

const webHost =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : 'localhost';

const devDefaultUrl = Platform.select({
  android: hostFromExpo ? `http://${hostFromExpo}:4000` : 'http://10.0.2.2:4000',
  ios: hostFromExpo ? `http://${hostFromExpo}:4000` : 'http://localhost:4000',
  web: `http://${webHost}:4000`,
  default: hostFromExpo ? `http://${hostFromExpo}:4000` : 'http://localhost:4000'
});

export const API_URL = explicitUrl || (__DEV__ ? devDefaultUrl : 'https://your-api.example.com');
