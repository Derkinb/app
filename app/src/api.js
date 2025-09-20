
import { API_URL } from './config';
import * as SecureStore from 'expo-secure-store';

export async function setToken(token) { await SecureStore.setItemAsync('token', token); }
export async function getToken() { return SecureStore.getItemAsync('token'); }

export async function api(path, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}
