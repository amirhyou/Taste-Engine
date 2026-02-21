import { Engine, EngineSnapshot } from '@taste-engine/core';
import { StorageService } from './storage';

const SNAPSHOT_PREFIX = 'engine_snapshot_';
const METADATA_PREFIX = 'engine_metadata_';

export interface ItemMetadata {
    id: string;
    name: string;
    artist?: string;
    imageUrl?: string;
}

export class EngineManager {
    private engine: Engine | null = null;
    private currentPlaylistId: string | null = null;
    private metadataCache: Record<string, ItemMetadata> = {};

    async init(playlistId: string, itemIds: string[], targetK: number = 10, metadata?: Record<string, ItemMetadata>): Promise<Engine> {
        this.currentPlaylistId = playlistId;
        const snapshot = StorageService.getJSON<EngineSnapshot>(`${SNAPSHOT_PREFIX}${playlistId}`);
        const cachedMetadata = StorageService.getJSON<Record<string, ItemMetadata>>(`${METADATA_PREFIX}${playlistId}`);

        this.metadataCache = { ...cachedMetadata, ...metadata };

        if (snapshot) {
            this.engine = new Engine(snapshot);
        } else {
            this.engine = new Engine({
                k: targetK,
                items: itemIds,
            });
        }

        // Persist metadata if new info was provided
        if (metadata) {
            StorageService.setJSON(`${METADATA_PREFIX}${playlistId}`, this.metadataCache);
        }

        return this.engine;
    }

    getMetadata(itemId: string): ItemMetadata {
        return this.metadataCache[itemId] || { id: itemId, name: 'Unknown Track' };
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

    hasSession(): boolean {
        return !!this.currentPlaylistId;
    }

    getCurrentPlaylistId(): string | null {
        return this.currentPlaylistId;
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
