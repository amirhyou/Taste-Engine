import { Engine, EngineSnapshot } from '@taste-engine/core';
import { StorageService } from './storage';

const SNAPSHOT_PREFIX = 'engine_snapshot_';
const METADATA_PREFIX = 'engine_metadata_';

export interface ItemMetadata {
    id: string;
    name: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
    previewUrl?: string;
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

        const validSnapshot = snapshot && snapshot.items?.length > 0 && snapshot.items.every((id) => id != null);
        if (validSnapshot) {
            this.engine = new Engine();
            this.engine.loadSnapshot(snapshot!);
        } else {
            if (snapshot) {
                // Corrupt snapshot — wipe it
                StorageService.delete(`${SNAPSHOT_PREFIX}${playlistId}`);
            }
            this.engine = new Engine({ k: targetK });
            this.engine.addItems(itemIds);
        }

        // Persist metadata if new info was provided
        if (metadata) {
            StorageService.setJSON(`${METADATA_PREFIX}${playlistId}`, this.metadataCache);
        }

        return this.engine;
    }

    getMetadata(itemId: string): ItemMetadata {
        const found = this.metadataCache[itemId];
        if (!found) console.warn('[DIAG] metadata miss for id:', itemId, '| cache size:', Object.keys(this.metadataCache).length);
        return found || { id: itemId, name: 'Unknown Track' };
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
