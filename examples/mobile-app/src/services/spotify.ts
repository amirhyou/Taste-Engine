import { AuthStorage } from './storage';

const BASE_URL = 'https://api.spotify.com/v1';

async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const token = await AuthStorage.getToken('spotify_access_token');
    if (!token) throw new Error('No access token');

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
    };
    // Only set Content-Type for requests with a body (POST/PUT/PATCH)
    if (options.method && options.method !== 'GET') {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    if (!response.ok) {
        const errBody = await response.text();
        console.error(`[spotify] ${response.status} on ${path}:`, errBody);
        throw new Error(`Spotify API ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

export const SpotifyService = {
    getPlaylists: async () => {
        return fetchWithAuth('/me/playlists');
    },

    getPlaylistTracks: async (playlistId: string) => {
        return fetchWithAuth(`/playlists/${playlistId}/items?market=from_token&limit=50`);
    },

    getPlaylistTracksPage: async (nextUrl: string) => {
        const path = nextUrl.replace('https://api.spotify.com/v1', '');
        return fetchWithAuth(path);
    },

    createPlaylist: async (userId: string, name: string) => {
        return fetchWithAuth(`/users/${userId}/playlists`, {
            method: 'POST',
            body: JSON.stringify({ name, description: 'Created by Taste Engine' }),
        });
    },

    updatePlaylistTracks: async (playlistId: string, uris: string[]) => {
        return fetchWithAuth(`/playlists/${playlistId}/tracks`, {
            method: 'PUT',
            body: JSON.stringify({ uris }),
        });
    },

    getCurrentUser: async () => {
        return fetchWithAuth('/me');
    },
};
