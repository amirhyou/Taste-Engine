import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

/**
 * High-performance synchronous storage for engine snapshots and non-sensitive data.
 */
export const mmkv = new MMKV({
    id: 'taste-engine-storage',
});

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
 */
export const AuthStorage = {
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
