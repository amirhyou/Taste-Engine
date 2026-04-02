import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking, ScrollView, Image } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyExportService } from '../services/spotifyExport';
import { engineManager, ItemMetadata } from '../services/engineManager';
import { sessionManager } from '../services/sessionManager';
import { sessionController } from '../services/sessionController';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { theme } from '../theme';

interface ResultScreenProps {
    onRestart: () => void;
}

export default function ResultScreen({ onRestart }: ResultScreenProps) {
    const { promptAsync, logout } = useSpotifyAuth();
    const [exporting, setExporting] = React.useState(false);
    const [result, setResult] = React.useState<{ success: boolean; url?: string; message?: string } | null>(null);
    const [topK, setTopK] = React.useState<ItemMetadata[]>([]);
    const contestedItems = sessionController.getContestedItems();

    React.useEffect(() => {
        try {
            const engine = engineManager.getEngine();
            const k = engine.snapshot().config.k;
            const ranking = engine.status().fullRanking.slice(0, k);
            setTopK(ranking.map(id => sessionController.getMetadata(id)));
        } catch (err) {
            console.warn('[ResultScreen] Unable to load top-k ranking', err);
        }
    }, []);

    const handleExport = async () => {
        setExporting(true);
        try {
            const engine = engineManager.getEngine();
            const playlistId = engineManager.getCurrentPlaylistId() || 'default';
            const k = engine.snapshot().config.k;
            const originalName = sessionManager.getSession(playlistId)?.playlistName;
            const res = await SpotifyExportService.exportResults(engine, playlistId, k, originalName);
            setResult({ success: true, url: res.external_urls.spotify });
            sessionManager.archiveSession(playlistId);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setResult({ success: false, message });
        } finally {
            setExporting(false);
        }
    };

    if (exporting) {
        return (
            <Screen>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loadingText}>Exporting to Spotify...</Text>
                </View>
            </Screen>
        );
    }

    if (result?.success) {
        return (
            <Screen>
                <View style={styles.centered}>
                    <Text style={styles.successEmoji}>🎉</Text>
                    <Text style={styles.title}>Playlist Created!</Text>
                    <Text style={styles.subtitle}>Your Top-K playlist is ready on Spotify.</Text>
                    <View style={styles.gap} />
                    <Button label="Open Spotify" onPress={() => Linking.openURL(result.url!)} style={styles.fullWidth} />
                    <View style={styles.smallGap} />
                    <Button label="Start New Session" onPress={onRestart} kind="secondary" style={styles.fullWidth} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.title}>Session Complete</Text>
                <Text style={styles.subtitle}>You've reached a stable ranking.</Text>

                {result?.success === false && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorTitle}>Export failed</Text>
                        <Text style={styles.errorText}>{result.message || 'Something went wrong.'}</Text>
                        <Text style={styles.errorHint}>
                            Tip: reconnect Spotify to re-consent playlist scopes if you see a 403.
                        </Text>
                        <View style={styles.smallGap} />
                        <Button
                            label="Reconnect Spotify"
                            onPress={async () => { await logout(); promptAsync(); }}
                        />
                    </View>
                )}

                {topK.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Your Top {topK.length}</Text>
                        <Text style={styles.cardCaption}>Final ranking ready for export.</Text>
                        {topK.map((item, idx) => (
                            <View key={item.id} style={styles.trackRow}>
                                <Text style={styles.rank}>{idx + 1}</Text>
                                {item.imageUrl
                                    ? <Image source={{ uri: item.imageUrl }} style={styles.trackImage} />
                                    : <View style={[styles.trackImage, styles.trackImagePlaceholder]} />
                                }
                                <View style={styles.trackTexts}>
                                    <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {contestedItems.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Contested</Text>
                        <Text style={styles.cardCaption}>These had conflicting votes — less certain in ranking.</Text>
                        {contestedItems.map(item => (
                            <View key={item.id} style={styles.trackRow}>
                                {item.imageUrl
                                    ? <Image source={{ uri: item.imageUrl }} style={styles.trackImage} />
                                    : <View style={[styles.trackImage, styles.trackImagePlaceholder]} />
                                }
                                <View style={styles.trackTexts}>
                                    <Text style={styles.trackName} numberOfLines={1}>{item.name}</Text>
                                    <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.actions}>
                    <Button label="Export to Spotify" onPress={handleExport} style={styles.fullWidth} />
                    <View style={styles.smallGap} />
                    <Button label="Go Back" onPress={onRestart} kind="secondary" style={styles.fullWidth} />
                </View>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    scroll: {
        padding: theme.spacing(5),
        paddingTop: theme.spacing(10),
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing(8),
    },
    successEmoji: {
        fontSize: 52,
        marginBottom: theme.spacing(4),
    },
    title: {
        ...theme.typography.title,
        textAlign: 'center',
        marginBottom: theme.spacing(2),
    },
    subtitle: {
        color: theme.colors.textSecondary,
        fontSize: 15,
        textAlign: 'center',
        marginBottom: theme.spacing(4),
    },
    loadingText: {
        color: theme.colors.textSecondary,
        marginTop: theme.spacing(4),
        fontSize: 15,
    },
    gap: { height: theme.spacing(6) },
    smallGap: { height: theme.spacing(3) },
    fullWidth: { width: '100%' },
    errorBox: {
        backgroundColor: '#1e1010',
        borderColor: theme.colors.danger,
        borderWidth: 1,
        borderRadius: theme.radius.md,
        padding: theme.spacing(4),
        marginBottom: theme.spacing(5),
    },
    errorTitle: {
        color: theme.colors.danger,
        fontWeight: '700',
        fontSize: 15,
        marginBottom: theme.spacing(2),
    },
    errorText: {
        color: '#ff9f9f',
        fontSize: 14,
        marginBottom: theme.spacing(2),
    },
    errorHint: {
        color: '#ffcf9f',
        fontSize: 12,
        marginBottom: theme.spacing(3),
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing(4),
        marginBottom: theme.spacing(4),
    },
    cardTitle: {
        ...theme.typography.subtitle,
        marginBottom: theme.spacing(1),
    },
    cardCaption: {
        color: theme.colors.textMuted,
        fontSize: 12,
        marginBottom: theme.spacing(3),
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing(2),
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    rank: {
        color: theme.colors.textMuted,
        fontSize: 13,
        fontWeight: '700',
        width: 24,
    },
    trackImage: {
        width: 40,
        height: 40,
        borderRadius: theme.radius.sm,
        marginRight: theme.spacing(3),
    },
    trackImagePlaceholder: {
        backgroundColor: theme.colors.surfaceSubtle,
    },
    trackTexts: { flex: 1 },
    trackName: {
        color: theme.colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    trackArtist: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    actions: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(8),
    },
});
