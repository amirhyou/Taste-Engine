import { SpotifyService } from './spotify';
import { Engine } from '@taste-engine/core';

export const SpotifyExportService = {
    /**
     * Exports the top-k results to a new or existing Spotify playlist.
     */
    exportResults: async (engine: Engine, originalPlaylistId: string, k: number) => {
        const status = engine.status();
        const topKIds = status.fullRanking.slice(0, k);
        const uris = topKIds.map((id: string) => `spotify:track:${id}`);

        // 1. Get current user
        const user = await SpotifyService.getCurrentUser();

        // 2. Create the playlist
        // TODO: In a more advanced version, check for an existing "Taste Engine" playlist for this source to update instead of creating new.
        const playlistName = `Taste Engine: Top ${k}`;
        const newPlaylist = await SpotifyService.createPlaylist(user.id, playlistName);

        // 3. Add tracks
        await SpotifyService.updatePlaylistTracks(newPlaylist.id, uris);

        return newPlaylist;
    }
};
