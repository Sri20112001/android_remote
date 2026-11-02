/**
 * `KeyValueBackend` backed by the platform keystore (`expo-secure-store`):
 * Android Keystore-encrypted SharedPreferences, iOS Keychain.
 *
 * Kept separate from `credential-store.ts` so the storage logic stays
 * importable in tests without pulling in a native module.
 */

import * as SecureStore from 'expo-secure-store';

import type { KeyValueBackend } from '@/auth/credential-store';

export function secureStoreBackend(): KeyValueBackend {
  return {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value),
    remove: (key) => SecureStore.deleteItemAsync(key),
  };
}
