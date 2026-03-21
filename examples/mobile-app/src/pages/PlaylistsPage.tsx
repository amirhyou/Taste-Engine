import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SpotifyService } from '../services/spotify';
import { engineManager, ItemMetadata } from '../services/engineManager';
import { sessionManager } from '../services/sessionManager';
import { StorageService } from '../services/storage';
import { Engine } from '@taste-engine/core';
import { ListItem } from '../components/ui/ListItem';
import { Badge } from '../components/ui/Badge';
import { theme } from '../theme';

interface PlaylistsPageProps {
    token: string | null;
    onSelected: () => void;
    onPreview: (title: string, tracks: ItemMetadata[]) => void;
}

export function PlaylistsPage({ token, onSelected, onPreview }: PlaylistsPageProps) {
    const [owned, setOwned] = React.useState<any[]>([]);
    const [shared, setShared] = React.useState<any[]>([]);
    const [engineMade, setEngineMade] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [targetK, setTargetK] = React.useState(20);
    const [tab, setTab] = React.useState<'owned' | 'shared' | 'engine'>('owned');
    const [sessionInfo, setSessionInfo] = React.useState<Record<string, { stability: number; k: number }>>({});
    const previewFallbackLimit = 20;

    const fillPreviewFallbacks = async (items: ItemMetadata[], limit: number) => {
        let filled = 0;
        for (const item of items) {
            if (filled >= limit) break;
            if (item.previewUrl || !item.name) continue;
            const preview = await SpotifyService.searchTrackPreview(item.name, item.artist);
            if (preview) {
                item.previewUrl = preview;
                filled += 1;
            }
        }
        return filled;
    };

    React.useEffect(() => {
        if (token) {
            const load = async () => {
                try {
                    const user = await SpotifyService.getCurrentUser();
                    const data = await SpotifyService.getPlaylists();
                    const items = data.items || [];
                    const mine = items.filter((p: any) => p.owner?.id === user.id);
                    const engine = mine.filter((p: any) => typeof p.name === 'string' && p.name.includes(': Top '));
                    const mineNonEngine = mine.filter((p: any) => !engine.includes(p));
                    const notMine = items.filter((p: any) => p.owner?.id !== user.id);
                    setOwned(mineNonEngine);
                    setShared(notMine);
                    setEngineMade(engine);

                    const all = [...mineNonEngine, ...engine, ...notMine];
                    const entries = await Promise.all(
                        all.map(async (p: any) => {
                            const meta = sessionManager.getSession(p.id);
                            if (!meta) return null;
                            const snapshot = StorageService.getJSON<any>(`engine_snapshot_${p.id}`);
                            if (!snapshot) return null;
                            try {
                                const e = new Engine();
                                e.loadSnapshot(snapshot);
                                const stability = Math.round((e.status()?.stability || 0) * 100);
                                const k = snapshot.config?.k ?? meta.targetK ?? 0;
                                return [p.id, { stability, k }] as const;
                            } catch {
                                return null;
                            }
                        })
                    );
                    const map: Record<string, { stability: number; k: number }> = {};
                    entries.forEach((e) => {
                        if (e) map[e[0]] = e[1];
                    });
                    setSessionInfo(map);
                } catch (err) {
                    console.error('[PlaylistsPage] fetch error:', err);
                } finally {
                    setLoading(false);
                }
            };
            load();
        }
    }, [token]);

    const handleSelect = async (playlist: any) => {
        setLoading(true);
        try {
            console.log('[PlaylistsPage] handleSelect', playlist?.id, playlist?.name);
            const tracks: any[] = [];
            let data = await SpotifyService.getPlaylistTracks(playlist.id);
            console.log('[PlaylistsPage] first page items:', data?.items?.length, 'sample preview_url:', data?.items?.[0]?.track?.preview_url);
            (data.items || []).forEach((i: any) => { const t = i.track || i.item; if (t && t.id) tracks.push(t); });
            while (data.next) {
                data = await SpotifyService.getPlaylistTracksPage(data.next);
                (data.items || []).forEach((i: any) => { const t = i.track || i.item; if (t && t.id) tracks.push(t); });
            }
            const itemIds = tracks.map((t: any) => t.id);
            const metaList: ItemMetadata[] = tracks.map((t: any) => ({
                id: t.id,
                name: t.name,
                artist: t.artists?.[0]?.name,
                album: t.album?.name,
                imageUrl: t.album?.images?.[0]?.url,
                previewUrl: t.preview_url,
            }));
            const basePreviewCount = metaList.filter(t => !!t.previewUrl).length;
            const filled = await fillPreviewFallbacks(metaList, previewFallbackLimit);
            const metadata: Record<string, ItemMetadata> = {};
            metaList.forEach((item) => {
                metadata[item.id] = item;
            });
            console.log('[PlaylistsPage] collected previews:', basePreviewCount, '+', filled, '/', metaList.length);
            await engineManager.init(playlist.id, itemIds, targetK, metadata);
            sessionManager.registerSession(playlist.id, playlist.name, targetK);
            onSelected();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load playlist';
            Alert.alert('Cannot load playlist', msg);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (playlist: any) => {
        setLoading(true);
        try {
            console.log('[PlaylistsPage] handlePreview', playlist?.id, playlist?.name);
            const tracks: any[] = [];
            let data = await SpotifyService.getPlaylistTracks(playlist.id);
            const firstItem = data?.items?.[0];
            const sampleTrack = firstItem?.track || firstItem?.item;
            console.log(
                '[PlaylistsPage] preview page items:',
                data?.items?.length,
                'item_keys:',
                firstItem ? Object.keys(firstItem) : null,
                'track_or_item:',
                sampleTrack
                    ? {
                          id: sampleTrack.id,
                          name: sampleTrack.name,
                          artists: sampleTrack.artists?.map((a: any) => a.name),
                          preview_url: sampleTrack.preview_url,
                          external_url: sampleTrack.external_urls?.spotify,
                          uri: sampleTrack.uri,
                          is_local: sampleTrack.is_local,
                          type: sampleTrack.type,
                          duration_ms: sampleTrack.duration_ms,
                          markets: sampleTrack.available_markets?.length,
                      }
                    : null
            );
            (data.items || []).forEach((i: any) => { const t = i.track || i.item; if (t && t.id) tracks.push(t); });
            while (data.next) {
                data = await SpotifyService.getPlaylistTracksPage(data.next);
                (data.items || []).forEach((i: any) => { const t = i.track || i.item; if (t && t.id) tracks.push(t); });
            }
            const meta: ItemMetadata[] = tracks.map((t: any) => ({
                id: t.id,
                name: t.name,
                artist: t.artists?.[0]?.name,
                album: t.album?.name,
                imageUrl: t.album?.images?.[0]?.url,
                previewUrl: t.preview_url,
            }));
            const basePreviewCount = meta.filter(t => !!t.previewUrl).length;
            const filled = await fillPreviewFallbacks(meta, previewFallbackLimit);
            console.log('[PlaylistsPage] preview meta with previewUrl:', basePreviewCount, '+', filled, '/', meta.length);
            onPreview(playlist.name || 'Playlist', meta);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to load playlist';
            Alert.alert('Cannot load playlist', msg);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={styles.text}>Loading your playlists...</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View style={styles.tabBar}>
                {(['owned', 'shared', 'engine'] as const).map(key => {
                    const label = key === 'owned' ? 'Yours' : key === 'shared' ? 'Followed' : 'Engine-made';
                    const active = tab === key;
                    return (
                        <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setTab(key)}>
                            <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                            <View style={[styles.tabIndicator, active && styles.tabIndicatorActive]} />
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.kPicker}>
                <Text style={styles.kLabel}>Target: Top {targetK}</Text>
                <View style={[styles.row, { justifyContent: 'space-around', marginVertical: 10 }]}>
                    {[10, 20, 50, 100].map(k => (
                        <TouchableOpacity
                            key={k}
                            onPress={() => setTargetK(k)}
                            style={[styles.kButton, targetK === k && styles.kButtonActive]}
                        >
                            <Text style={[styles.kButtonText, targetK === k && styles.kButtonTextActive]}>{k}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <FlatList
                data={tab === 'owned' ? owned : tab === 'shared' ? shared : engineMade}
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
                        onPress={() => {
                            if (tab === 'engine') {
                                handlePreview(item);
                            } else {
                                handleSelect(item);
                            }
                        }}
                        trailing={
                            sessionInfo[item.id] ? (
                                <Badge
                                    label={`Past: ${sessionInfo[item.id].stability}% (Top ${sessionInfo[item.id].k})`}
                                    tone={sessionInfo[item.id].stability >= 90 ? 'success' : 'default'}
                                />
                            ) : undefined
                        }
                    />
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: theme.colors.textPrimary,
        marginTop: 10,
    },
    tabBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: theme.spacing(2),
    },
    tabText: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    tabTextActive: {
        color: theme.colors.accent,
    },
    tabIndicator: {
        marginTop: theme.spacing(1.5),
        height: 2,
        width: '60%',
        backgroundColor: 'transparent',
    },
    tabIndicatorActive: {
        backgroundColor: theme.colors.accent,
    },
    kPicker: {
        paddingHorizontal: theme.spacing(5),
        marginBottom: theme.spacing(2),
    },
    kLabel: {
        color: theme.colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
    },
    kButton: {
        paddingVertical: theme.spacing(2),
        paddingHorizontal: theme.spacing(4),
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.accent,
    },
    kButtonActive: {
        backgroundColor: theme.colors.accent,
    },
    kButtonText: {
        color: theme.colors.accent,
        fontWeight: 'bold',
    },
    kButtonTextActive: {
        color: theme.colors.accentText,
    },
});
