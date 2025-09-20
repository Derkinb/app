import { Platform } from 'react-native';

// WEB -> backend na localhost:4000
// ANDROID (emulator) -> 10.0.2.2:4000
// ANDROID (fizyczny telefon w tej samej sieci) -> wpisz IP komputera, np. http://192.168.0.10:4000
const DEV_WEB = 'http://localhost:4000';
const DEV_ANDROID = 'http://10.0.2.2:4000';

export const API_URL =
  __DEV__
    ? (Platform.OS === 'web' ? DEV_WEB : DEV_ANDROID)
    : 'https://your-api.example.com';
