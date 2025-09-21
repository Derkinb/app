
import { API_URL } from './config';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'token';
let secureStoreAvailable;
let memoryToken = null;

async function hasSecureStore() {
  if (secureStoreAvailable === undefined) {
    try {
      secureStoreAvailable = (await SecureStore.isAvailableAsync()) === true;
    } catch (error) {
      secureStoreAvailable = false;
    }
  }
  return secureStoreAvailable;
}

function getLocalStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

export async function setToken(token) {
  const useSecureStore = await hasSecureStore();
  if (useSecureStore) {
    if (!token) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
    memoryToken = token || null;
    return;
  }

  const storage = getLocalStorage();
  if (storage) {
    if (!token) {
      storage.removeItem(TOKEN_KEY);
    } else {
      storage.setItem(TOKEN_KEY, token);
    }
  }
  memoryToken = token || null;
}

export async function clearToken() {
  await setToken(null);
}

export async function getToken() {
  const useSecureStore = await hasSecureStore();
  if (useSecureStore) {
    try {
      const value = await SecureStore.getItemAsync(TOKEN_KEY);
      memoryToken = value || null;
      return value;
    } catch (error) {
      return memoryToken;
    }
  }

  const storage = getLocalStorage();
  if (storage) {
    const value = storage.getItem(TOKEN_KEY);
    memoryToken = value || null;
    return value;
  }

  return memoryToken;
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
    const error = new Error(message || 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
