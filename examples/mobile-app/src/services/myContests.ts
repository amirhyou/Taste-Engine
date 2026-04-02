import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'tastify_my_contests';

export interface SavedContest {
    id: string;
    title: string;
    inviteCode: string;
    published: boolean;
    closed: boolean;
    createdAt: number;
}

async function load(): Promise<SavedContest[]> {
    try {
        const raw = Platform.OS === 'web'
            ? localStorage.getItem(KEY)
            : await SecureStore.getItemAsync(KEY);
        if (!raw) return [];
        return JSON.parse(raw) as SavedContest[];
    } catch {
        return [];
    }
}

async function save(items: SavedContest[]): Promise<void> {
    const raw = JSON.stringify(items);
    if (Platform.OS === 'web') {
        localStorage.setItem(KEY, raw);
    } else {
        await SecureStore.setItemAsync(KEY, raw);
    }
}

export const myContestsStore = {
    async getAll(): Promise<SavedContest[]> {
        const items = await load();
        return items.sort((a, b) => b.createdAt - a.createdAt);
    },

    async add(contest: Omit<SavedContest, 'createdAt'>): Promise<void> {
        const items = await load();
        items.push({ ...contest, createdAt: Date.now() });
        await save(items);
    },

    async setPublished(id: string, published: boolean): Promise<void> {
        const items = await load();
        const idx = items.findIndex(c => c.id === id);
        if (idx !== -1) {
            items[idx].published = published;
            await save(items);
        }
    },

    async setClosed(id: string): Promise<void> {
        const items = await load();
        const idx = items.findIndex(c => c.id === id);
        if (idx !== -1) {
            items[idx].closed = true;
            items[idx].published = false;
            await save(items);
        }
    },
};
