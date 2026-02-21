import * as React from 'react';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import { AuthStorage } from './storage';

WebBrowser.maybeCompleteAuthSession();

// Endpoint
const discovery = {
    authorizationEndpoint: 'https://accounts.spotify.com/authorize',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const CLIENT_ID = '9fe641971da145ada727eb254418e531'; // User provided
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
];

export function useSpotifyAuth() {
    const [token, setToken] = React.useState<string | null>(null);

    const [request, response, promptAsync] = useAuthRequest(
        {
            responseType: ResponseType.Code,
            clientId: CLIENT_ID,
            scopes: SCOPES,
            usePKCE: true,
            redirectUri: makeRedirectUri({
                scheme: 'taste-engine',
            }),
        },
        discovery
    );

    React.useEffect(() => {
        if (response?.type === 'success') {
            const { code } = response.params;
            handleTokenExchange(code);
        }
    }, [response]);

    React.useEffect(() => {
        // Initial load: check for existing token
        AuthStorage.getToken('spotify_access_token').then((t) => {
            if (t) setToken(t);
        });
    }, []);

    const handleTokenExchange = async (code: string) => {
        // In a real app, you might need a backend to exchange the code for the client secret if not using pure PKCE
        // Spotify supports pure PKCE without secret for public clients.
        try {
            const response = await fetch(discovery.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: makeRedirectUri({ scheme: 'taste-engine' }),
                    client_id: CLIENT_ID,
                    code_verifier: request?.codeVerifier || '',
                }).toString(),
            });

            const data = await response.json();
            if (data.access_token) {
                await AuthStorage.saveToken('spotify_access_token', data.access_token);
                if (data.refresh_token) {
                    await AuthStorage.saveToken('spotify_refresh_token', data.refresh_token);
                }
                setToken(data.access_token);
            }
        } catch (error) {
            console.error('Error exchanging token:', error);
        }
    };

    const logout = async () => {
        await AuthStorage.deleteToken('spotify_access_token');
        await AuthStorage.deleteToken('spotify_refresh_token');
        setToken(null);
    };

    return {
        token,
        promptAsync: () => promptAsync(),
        logout,
        ready: !!request,
    };
}
