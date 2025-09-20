
import { API_URL } from './config';
import * as SecureStore from 'expo-secure-store';

export async function setToken(token) {
  if (token) {
    await SecureStore.setItemAsync('token', token);
  }
}

export async function clearToken() {
  await SecureStore.deleteItemAsync('token');
}

export async function getToken() {
  return SecureStore.getItemAsync('token');
}

export async function api(path, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers, body });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (response.status === 401) {
    await clearToken();
  }

  if (!response.ok) {
    const message = data?.error || data?.message || response.statusText;
    throw new Error(message || 'Request failed');
  }

  return data;
}
