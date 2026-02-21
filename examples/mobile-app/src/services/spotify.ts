import { AuthStorage } from './storage';

const BASE_URL = 'https://api.spotify.com/v1';

async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const token = await AuthStorage.getToken('spotify_access_token');
    if (!token) throw new Error('No access token');

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });

    if (response.status === 401) {
        // TODO: Implement refresh token logic if 401
        throw new Error('Unauthorized');
    }

    return response.json();
}

export const SpotifyService = {
    getPlaylists: async () => {
        return fetchWithAuth('/me/playlists');
    },

    getPlaylistTracks: async (playlistId: string) => {
        return fetchWithAuth(`/playlists/${playlistId}/tracks`);
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
