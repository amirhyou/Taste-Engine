import { AuthStorage } from './storage';
import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY } from './spotifyConfig';

const BASE_URL = 'https://api.spotify.com/v1';
const previewCache = new Map<string, string | null>();

function makePreviewKey(trackName: string, artist?: string) {
    return `${trackName.toLowerCase()}::${(artist || '').toLowerCase()}`;
}

async function refreshAccessToken(): Promise<string> {
    const refreshToken = await AuthStorage.getToken('spotify_refresh_token');
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(SPOTIFY_DISCOVERY.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: SPOTIFY_CLIENT_ID,
        }).toString(),
    });

    const data = await response.json();
    if (!response.ok || !data.access_token) {
        throw new Error('Failed to refresh access token');
    }

    await AuthStorage.saveToken('spotify_access_token', data.access_token);
    if (data.refresh_token) {
        await AuthStorage.saveToken('spotify_refresh_token', data.refresh_token);
    }

    return data.access_token as string;
}

// Utility to chunk an array into batches of size n
function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

async function clearTokens() {
    await AuthStorage.deleteToken('spotify_access_token');
    await AuthStorage.deleteToken('spotify_refresh_token');
}

async function fetchWithAuth(path: string, options: RequestInit = {}, allowRetry = true) {
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

    // Handle expired/invalid tokens by attempting one refresh then replaying the request.
    if (response.status === 401 && allowRetry) {
        try {
            await refreshAccessToken();
            return fetchWithAuth(path, options, false);
        } catch (refreshErr) {
            console.error('[spotify] token refresh failed:', refreshErr);
            await clearTokens();
            throw new Error('Spotify session expired. Please reconnect.');
        }
    }

    if (response.status === 403) {
        const errBody = await response.text();
        console.error(`[spotify] 403 on ${path}:`, errBody);
        // Preserve server message when available to help users re-consent scopes.
        let detail = 'Spotify denied access. For reading, grant playlist-read-private + playlist-read-collaborative; for writing, playlist-modify-private/public.';
        try {
            const parsed = JSON.parse(errBody);
            if (parsed?.error?.message) {
                detail = parsed.error.message;
                // If Spotify returns a generic "Forbidden", still add guidance.
                if (detail.toLowerCase() === 'forbidden') {
                    detail += ' (Missing scopes or playlist is private/non-collaborative? Reconnect to re-consent; note some followed private playlists cannot be read.)';
                }
            }
        } catch { /* ignore parse errors */ }
        throw new Error(detail);
    }

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

    createPlaylist: async (_userId: string, name: string) => {
        // Use /me to avoid mismatched user IDs and rely on the current token's owner.
        return fetchWithAuth(`/me/playlists`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                description: 'Created by Taste Engine',
                public: false, // avoid requiring playlist-modify-public; uses playlist-modify-private scope
                collaborative: false,
            }),
        });
    },

    /**
     * Adds tracks to a playlist, respecting Spotify's 100-URI per request limit.
     * Uses POST for all batches (append). Safe for brand-new playlists.
     * Uses the modern /items endpoint per Spotify API docs.
     */
    updatePlaylistTracks: async (playlistId: string, uris: string[]) => {
        if (uris.length === 0) return;

        // Spotify limits to 100 URIs per request.
        const batches = chunk(uris, 100);

        for (let i = 0; i < batches.length; i++) {
            await fetchWithAuth(`/playlists/${playlistId}/items`, {
                method: 'POST',
                body: JSON.stringify({ uris: batches[i], position: i * 100 }),
            });
        }
    },

    getCurrentUser: async () => {
        return fetchWithAuth('/me');
    },

    getTracks: async (ids: string[]): Promise<any[]> => {
        if (ids.length === 0) return [];
        const data = await fetchWithAuth(`/tracks?ids=${ids.join(',')}`);
        return data?.tracks ?? [];
    },

    searchTrackPreview: async (trackName: string, artist?: string): Promise<string | null> => {
        if (!trackName) return null;
        const key = makePreviewKey(trackName, artist);
        if (previewCache.has(key)) return previewCache.get(key) ?? null;

        const q = artist
            ? `track:"${trackName}" artist:"${artist}"`
            : `track:"${trackName}"`;
        const params = new URLSearchParams({
            q,
            type: 'track',
            limit: '1',
            market: 'from_token',
            include_external: 'audio',
        });
        const data = await fetchWithAuth(`/search?${params.toString()}`);
        const preview = data?.tracks?.items?.[0]?.preview_url ?? null;
        previewCache.set(key, preview);
        return preview;
    },
};
