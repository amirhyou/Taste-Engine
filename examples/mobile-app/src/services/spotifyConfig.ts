// Shared Spotify OAuth/REST configuration so services and hooks stay in sync.
export const SPOTIFY_DISCOVERY = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your .env file.
// The fallback value is for local Expo Go development only.
export const SPOTIFY_CLIENT_ID =
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '9fe641971da145ada727eb254418e531';
