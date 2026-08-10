import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { readJSON, removeKey, writeJSON } from './storage';

/**
 * SecureStore has no web implementation, so fall back to AsyncStorage there.
 * Only the session pointer (a user id) lives here — never the password hash.
 */
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

export async function secureGet<T>(key: string, fallback: T): Promise<T> {
  if (!isNative) return readJSON<T>(key, fallback);
  try {
    const raw = await SecureStore.getItemAsync(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function secureSet(key: string, value: unknown): Promise<void> {
  if (!isNative) return writeJSON(key, value);
  try {
    await SecureStore.setItemAsync(key, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

export async function secureDelete(key: string): Promise<void> {
  if (!isNative) return removeKey(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* noop */
  }
}
