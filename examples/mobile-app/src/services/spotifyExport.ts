import { SpotifyService } from './spotify';
import { Engine } from '@taste-engine/core';

export const SpotifyExportService = {
    /**
     * Exports the top-k results to a new or existing Spotify playlist.
     */
    exportResults: async (
        engine: Engine,
        originalPlaylistId: string,
        k: number,
        originalPlaylistName?: string
    ) => {
        const status = engine.status();
        const topKIds = status.fullRanking.slice(0, k);
        const uris = topKIds.map((id: string) => `spotify:track:${id}`);

        // 1. Determine target playlist name
        const baseName = originalPlaylistName || 'Taste Engine';
        const playlistName = `${baseName}: Top ${k}`;

        // 2. Try to find an existing playlist with that name (first page)
        const existingList = await SpotifyService.getPlaylists();
        const existing = existingList.items?.find((p: any) => p.name === playlistName);

        const target = existing ?? await SpotifyService.createPlaylist('me', playlistName);

        // 3. Add tracks (append in order; playlist is usually empty/new)
        await SpotifyService.updatePlaylistTracks(target.id, uris);

        return target;
    }
};
