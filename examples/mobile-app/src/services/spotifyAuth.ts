import * as React from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';
import Constants from 'expo-constants';
import { AuthStorage } from './storage';
import { SPOTIFY_CLIENT_ID, SPOTIFY_DISCOVERY } from './spotifyConfig';

WebBrowser.maybeCompleteAuthSession();

const SCOPES = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
];

export function useSpotifyAuth() {
    const [token, setToken] = React.useState<string | null>(null);
    const isExpoGo = Constants.appOwnership === 'expo';
    const useProxy = Platform.OS !== 'web' && isExpoGo;
    const redirectUri = Platform.OS === 'web'
        ? 'http://127.0.0.1:8081'
        : (useProxy
            ? 'https://auth.expo.io/@amirhyou/tastify'
            : makeRedirectUri({ scheme: 'taste-engine', path: 'oauth' }));

    const [request, response, promptAsync] = useAuthRequest(
        {
            responseType: ResponseType.Code,
            clientId: SPOTIFY_CLIENT_ID,
            scopes: SCOPES,
            usePKCE: true,
            redirectUri,
            extraParams: {
                // Force consent dialog so playlist scopes are explicitly granted when re-connecting.
                show_dialog: 'true',
            },
        },
        SPOTIFY_DISCOVERY
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
            const response = await fetch(SPOTIFY_DISCOVERY.tokenEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri,
                    client_id: SPOTIFY_CLIENT_ID,
                    code_verifier: request?.codeVerifier || '',
                }).toString(),
            });

            const data = await response.json();
            console.log('[spotifyAuth] token exchange response:', JSON.stringify(data));
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
