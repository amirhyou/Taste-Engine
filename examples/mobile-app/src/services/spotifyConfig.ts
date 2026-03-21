// Shared Spotify OAuth/REST configuration so services and hooks stay in sync.
export const SPOTIFY_DISCOVERY = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

// Public client id provided by the user (PKCE flow).
export const SPOTIFY_CLIENT_ID = '9fe641971da145ada727eb254418e531';
