import React from 'react';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyService } from '../services/spotify';

export function useSpotifyUser() {
    const { token } = useSpotifyAuth();
    const [userId, setUserId] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [attempt, setAttempt] = React.useState(0);

    React.useEffect(() => {
        if (!token) {
            setUserId(null);
            setError(null);
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        SpotifyService.getCurrentUser()
            .then((u: { id?: string }) => {
                if (!cancelled) setUserId(u?.id ?? null);
            })
            .catch(() => {
                if (!cancelled) {
                    setUserId(null);
                    setError('Could not load your Spotify profile.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [token, attempt]);

    const refetch = () => setAttempt((a) => a + 1);

    return { userId, loading, error, refetch };
}
