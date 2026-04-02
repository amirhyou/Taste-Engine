import * as React from 'react';
import { Platform, Alert } from 'react-native';
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

    const exchangedCodeRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (response?.type !== 'success') return;
        const code = response.params.code;
        if (!code) return;
        const verifier = request?.codeVerifier;
        if (!verifier) {
            // useAuthRequest may not have populated PKCE yet; retry when `request` updates.
            return;
        }
        if (exchangedCodeRef.current === code) return;
        exchangedCodeRef.current = code;

        void (async () => {
            try {
                const tokenResponse = await fetch(SPOTIFY_DISCOVERY.tokenEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirectUri,
                        client_id: SPOTIFY_CLIENT_ID,
                        code_verifier: verifier,
                    }).toString(),
                });

                const data = await tokenResponse.json();
                if (data.access_token) {
                    await AuthStorage.saveToken('spotify_access_token', data.access_token);
                    if (data.refresh_token) {
                        await AuthStorage.saveToken('spotify_refresh_token', data.refresh_token);
                    }
                    setToken(data.access_token);
                    return;
                }
                const msg =
                    typeof data.error_description === 'string'
                        ? data.error_description
                        : typeof data.error === 'string'
                            ? data.error
                            : !tokenResponse.ok
                                ? `HTTP ${tokenResponse.status}`
                                : 'Token exchange failed';
                Alert.alert('Spotify sign-in failed', msg);
            } catch (error) {
                console.error('Error exchanging token:', error);
                Alert.alert(
                    'Spotify sign-in failed',
                    error instanceof Error ? error.message : 'Unknown error',
                );
            }
        })();
    }, [response, request, redirectUri]);

    React.useEffect(() => {
        // Initial load: check for existing token
        AuthStorage.getToken('spotify_access_token').then((t) => {
            if (t) setToken(t);
        });
    }, []);

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
