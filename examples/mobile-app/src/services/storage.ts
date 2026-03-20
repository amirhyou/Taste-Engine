import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function createStorage() {
    if (Platform.OS === 'web') {
        return {
            getString: (key: string) => localStorage.getItem(key) ?? undefined,
            set: (key: string, value: string) => localStorage.setItem(key, value),
            delete: (key: string) => localStorage.removeItem(key),
        };
    }
    const { MMKV } = require('react-native-mmkv');
    return new MMKV({ id: 'taste-engine-storage' });
}

const mmkv = createStorage();

export const StorageService = {
    get: (key: string): string | undefined => {
        return mmkv.getString(key);
    },
    set: (key: string, value: string): void => {
        mmkv.set(key, value);
    },
    delete: (key: string): void => {
        mmkv.delete(key);
    },
    getJSON: <T>(key: string): T | null => {
        const val = mmkv.getString(key);
        if (!val) return null;
        try {
            return JSON.parse(val) as T;
        } catch {
            return null;
        }
    },
    setJSON: (key: string, value: any): void => {
        mmkv.set(key, JSON.stringify(value));
    },
};

/**
 * Secure storage for sensitive OAuth tokens.
 * Falls back to localStorage on web (not truly secure, but functional for dev).
 */
export const AuthStorage = Platform.OS === 'web'
    ? {
          saveToken: async (key: string, value: string) => {
              localStorage.setItem(key, value);
          },
          getToken: async (key: string) => {
              return localStorage.getItem(key);
          },
          deleteToken: async (key: string) => {
              localStorage.removeItem(key);
          },
      }
    : {
          saveToken: async (key: string, value: string) => {
              await SecureStore.setItemAsync(key, value);
          },
          getToken: async (key: string) => {
              return await SecureStore.getItemAsync(key);
          },
          deleteToken: async (key: string) => {
              await SecureStore.deleteItemAsync(key);
          },
      };
