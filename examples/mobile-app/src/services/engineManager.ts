import { Engine, EngineSnapshot } from '@taste-engine/core';
import { StorageService } from './storage';

const SNAPSHOT_PREFIX = 'engine_snapshot_';

export class EngineManager {
    private engine: Engine | null = null;
    private currentPlaylistId: string | null = null;

    async init(playlistId: string, itemIds: string[]): Promise<Engine> {
        this.currentPlaylistId = playlistId;
        const snapshot = StorageService.getJSON<EngineSnapshot>(`${SNAPSHOT_PREFIX}${playlistId}`);

        if (snapshot) {
            this.engine = new Engine(snapshot);
        } else {
            this.engine = new Engine({
                k: 10, // Default K, can be tuned via UI
                items: itemIds,
            });
        }

        return this.engine;
    }

    getEngine(): Engine {
        if (!this.engine) throw new Error('Engine not initialized');
        return this.engine;
    }

    async save(): Promise<void> {
        if (!this.engine || !this.currentPlaylistId) return;
        const snapshot = this.engine.snapshot();
        StorageService.setJSON(`${SNAPSHOT_PREFIX}${this.currentPlaylistId}`, snapshot);
    }

    async clearSession(): Promise<void> {
        if (this.currentPlaylistId) {
            StorageService.delete(`${SNAPSHOT_PREFIX}${this.currentPlaylistId}`);
        }
        this.engine = null;
        this.currentPlaylistId = null;
    }
}

export const engineManager = new EngineManager();
