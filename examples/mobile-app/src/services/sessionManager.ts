import { StorageService } from './storage';

export interface SessionMeta {
    playlistId: string;
    playlistName: string;
    targetK: number;
    lastActive: number;
    status: 'active' | 'archived';
    engineVersion: string;
}

const SESSION_INDEX_KEY = 'taste_session_index';
const CURRENT_ENGINE_VERSION = '0.1.0'; // To match @taste-engine/core

export class SessionManager {
    private index: Record<string, SessionMeta> = {};

    constructor() {
        this.index = StorageService.getJSON<Record<string, SessionMeta>>(SESSION_INDEX_KEY) || {};
    }

    registerSession(playlistId: string, name: string, k: number) {
        this.index[playlistId] = {
            playlistId,
            playlistName: name,
            targetK: k,
            lastActive: Date.now(),
            status: 'active',
            engineVersion: CURRENT_ENGINE_VERSION,
        };
        this.saveIndex();
    }

    getSession(playlistId: string): SessionMeta | undefined {
        return this.index[playlistId];
    }

    getAllSessions(): SessionMeta[] {
        return Object.values(this.index).sort((a, b) => b.lastActive - a.lastActive);
    }

    archiveSession(playlistId: string) {
        if (this.index[playlistId]) {
            this.index[playlistId].status = 'archived';
            this.index[playlistId].lastActive = Date.now();
            this.saveIndex();
        }
    }

    deleteSession(playlistId: string) {
        StorageService.delete(`engine_snapshot_${playlistId}`);
        StorageService.delete(`engine_metadata_${playlistId}`);
        delete this.index[playlistId];
        this.saveIndex();
    }

    private saveIndex() {
        StorageService.setJSON(SESSION_INDEX_KEY, this.index);
    }

    /**
     * Prevents storage bloat by keeping only the N most recent sessions.
     */
    pruneSessions(maxSessions: number = 10) {
        const sorted = this.getAllSessions();
        if (sorted.length <= maxSessions) return;

        const toDelete = sorted.slice(maxSessions);
        toDelete.forEach(s => {
            this.deleteSession(s.playlistId);
        });
    }

    /**
     * Integrity check: Returns true if the snapshot version is compatible.
     */
    isVersionCompatible(playlistId: string): boolean {
        const meta = this.getSession(playlistId);
        if (!meta) return true; // New session
        return meta.engineVersion === CURRENT_ENGINE_VERSION;
    }
}

export const sessionManager = new SessionManager();
