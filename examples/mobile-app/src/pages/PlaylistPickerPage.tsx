import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SpotifyService } from '../services/spotify';
import { ListItem } from '../components/ui/ListItem';
import { theme } from '../theme';
import { TouchableOpacity } from 'react-native';

export interface TrackMeta {
    name: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
    previewUrl?: string;
}

export interface PickedPlaylist {
    trackIds: string[];
    trackMeta: Record<string, TrackMeta>;
    playlistName: string;
    imageUrl?: string;
}

interface PlaylistPickerPageProps {
    token: string | null;
    onSelected: (result: PickedPlaylist) => void;
    onAuthError: () => void;
}

const TABS = [
    { key: 'owned', label: 'Yours' },
    { key: 'followed', label: 'Followed' },
] as const;
type TabKey = typeof TABS[number]['key'];

export function PlaylistPickerPage({ token, onSelected, onAuthError }: PlaylistPickerPageProps) {
    const [owned, setOwned] = React.useState<any[]>([]);
    const [followed, setFollowed] = React.useState<any[]>([]);
    const [tab, setTab] = React.useState<TabKey>('owned');
    const [loading, setLoading] = React.useState(true);
    const [selecting, setSelecting] = React.useState(false);

    const isAuthError = (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err || '');
        const lower = msg.toLowerCase();
        return lower.includes('unauthorized') || lower.includes('no access token') ||
            lower.includes('expired') || lower.includes('session');
    };

    React.useEffect(() => {
        if (!token) return;
        const load = async () => {
            try {
                const user = await SpotifyService.getCurrentUser();
                const data = await SpotifyService.getPlaylists();
                const items: any[] = data.items || [];
                setOwned(items.filter((p: any) => p.owner?.id === user.id));
                setFollowed(items.filter((p: any) => p.owner?.id !== user.id));
            } catch (err) {
                if (isAuthError(err)) { Alert.alert('Spotify disconnected', 'Please reconnect.'); onAuthError(); }
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token]);

    const handleSelect = async (playlist: any) => {
        setSelecting(true);
        try {
            const tracks: any[] = [];
            let data = await SpotifyService.getPlaylistTracks(playlist.id);
            (data.items || []).forEach((i: any) => { const t = i.track || i.item; if (t?.id) tracks.push(t); });
            while (data.next) {
                data = await SpotifyService.getPlaylistTracksPage(data.next);
                (data.items || []).forEach((i: any) => { const t = i.track || i.item; if (t?.id) tracks.push(t); });
            }
            const trackMeta: Record<string, TrackMeta> = {};
            tracks.forEach((t: any) => {
                trackMeta[t.id] = {
                    name: t.name ?? 'Unknown Track',
                    artist: t.artists?.[0]?.name,
                    album: t.album?.name,
                    imageUrl: t.album?.images?.[0]?.url,
                    previewUrl: t.preview_url ?? undefined,
                };
            });
            onSelected({
                trackIds: tracks.map((t: any) => t.id),
                trackMeta,
                playlistName: playlist.name,
                imageUrl: playlist.images?.[0]?.url,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load playlist';
            Alert.alert('Cannot load playlist', msg);
            if (isAuthError(err)) onAuthError();
        } finally {
            setSelecting(false);
        }
    };

    if (loading || selecting) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.loadingText}>{selecting ? 'Loading tracks...' : 'Loading playlists...'}</Text>
            </View>
        );
    }

    const items = tab === 'owned' ? owned : followed;

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.tabBar}>
                {TABS.map(({ key, label }) => (
                    <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setTab(key)}>
                        <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
                        <View style={[styles.tabIndicator, tab === key && styles.tabIndicatorActive]} />
                    </TouchableOpacity>
                ))}
            </View>
            {items.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No playlists found</Text>
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ListItem
                            title={item.name}
                            subtitle={
                                item.owner?.display_name
                                    ? `by ${item.owner.display_name} · ${item.tracks?.total ?? item.items?.total ?? '?'} tracks`
                                    : `${item.tracks?.total ?? item.items?.total ?? '?'} tracks`
                            }
                            imageUrl={item.images?.[0]?.url}
                            onPress={() => handleSelect(item)}
                        />
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: theme.colors.textSecondary, marginTop: theme.spacing(3) },
    emptyText: { color: theme.colors.textMuted },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    tabItem: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing(2) },
    tabText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
    tabTextActive: { color: theme.colors.accent },
    tabIndicator: { marginTop: theme.spacing(1.5), height: 2, width: '60%', backgroundColor: 'transparent' },
    tabIndicatorActive: { backgroundColor: theme.colors.accent },
});
