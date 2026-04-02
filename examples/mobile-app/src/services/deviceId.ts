import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';

const KEY = 'taste_device_id';
let _cached: string | null = null;

export async function getDeviceId(): Promise<string> {
    if (_cached) return _cached;

    if (Platform.OS === 'web') {
        let id = localStorage.getItem(KEY);
        if (!id) {
            id = randomUUID();
            localStorage.setItem(KEY, id);
        }
        _cached = id;
        return _cached;
    }

    let id = await SecureStore.getItemAsync(KEY);
    if (!id) {
        id = randomUUID();
        await SecureStore.setItemAsync(KEY, id);
    }
    _cached = id;
    return _cached;
}
