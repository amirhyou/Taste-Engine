import React from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Linking, ScrollView, Image } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyExportService } from '../services/spotifyExport';
import { engineManager, ItemMetadata } from '../services/engineManager';
import { sessionManager } from '../services/sessionManager';
import { sessionController } from '../services/sessionController';

interface ResultScreenProps {
    onRestart: () => void;
}

export default function ResultScreen({ onRestart }: ResultScreenProps) {
    const { token, promptAsync, logout } = useSpotifyAuth();
    const [exporting, setExporting] = React.useState(false);
    const [result, setResult] = React.useState<{ success: boolean; url?: string; message?: string } | null>(null);
    const [topK, setTopK] = React.useState<ItemMetadata[]>([]);
    const contestedItems = sessionController.getContestedItems();

    React.useEffect(() => {
        try {
            const engine = engineManager.getEngine();
            const k = engine.snapshot().config.k;
            const ranking = engine.status().fullRanking.slice(0, k);
            const items: ItemMetadata[] = ranking.map(id => sessionController.getMetadata(id));
            setTopK(items);
        } catch (err) {
            console.warn('[ResultScreen] Unable to load top-k ranking', err);
            setTopK([]);
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

            // Archive session on completion
            sessionManager.archiveSession(playlistId);
        } catch (err) {
            console.error('Export failed', err);
            const message = err instanceof Error ? err.message : 'Unknown error';
            setResult({ success: false, message });
        } finally {
            setExporting(false);
        }
    };

    if (exporting) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1DB954" />
                <Text style={styles.text}>Exporting to Spotify...</Text>
            </View>
        );
    }

    if (result?.success) {
        return (
            <View style={styles.centered}>
                <Text style={styles.title}>Success! 🎉</Text>
                <Text style={styles.text}>Your Top-K playlist has been created.</Text>
                <View style={{ marginVertical: 20 }}>
                    <Button title="Open Spotify" onPress={() => Linking.openURL(result.url!)} color="#1DB954" />
                </View>
                <Button title="Start New Session" onPress={onRestart} />
            </View>
        );
    }

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Session Complete</Text>
            <Text style={styles.text}>You have reached a stable ranking.</Text>

            {result?.success === false && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorTitle}>Export failed</Text>
                    <Text style={styles.errorText}>{result.message || 'Something went wrong.'}</Text>
                    <Text style={styles.errorHint}>
                        Tip: Spotify sometimes returns 403 if playlist-modify-private/public wasn’t granted. Reconnect to force consent.
                    </Text>
                    <View style={{ height: 10 }} />
                    <Button
                        title="Reconnect Spotify"
                        onPress={async () => { await logout(); promptAsync(); }}
                        color="#1DB954"
                    />
                </View>
            )}

            {topK.length > 0 && (
                <View style={styles.listContainer}>
                    <Text style={styles.subtitle}>Your Top {topK.length}</Text>
                    <Text style={styles.caption}>Final ranking ready for export.</Text>
                    {topK.map((item, idx) => (
                        <View key={item.id} style={styles.itemRow}>
                            <Text style={styles.rank}>{idx + 1}.</Text>
                            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />}
                            <View>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.artistName}>{item.artist}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {contestedItems.length > 0 && (
                <View style={styles.contestedContainer}>
                    <Text style={styles.subtitle}>Contested Songs</Text>
                    <Text style={styles.caption}>These songs had conflicting votes and are less certain in the ranking.</Text>
                    {contestedItems.map(item => (
                        <View key={item.id} style={styles.itemRow}>
                            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />}
                            <View>
                                <Text style={styles.itemName}>{item.name}</Text>
                                <Text style={styles.artistName}>{item.artist}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            <View style={{ marginVertical: 30, width: '100%' }}>
                <Button title="Export to Spotify" onPress={handleExport} color="#1DB954" />
                <View style={{ height: 10 }} />
                <Button title="Go Back" onPress={onRestart} color="#666" />
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: '#121212',
        alignItems: 'center',
        paddingTop: 80,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
        padding: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 5,
    },
    text: {
        color: '#B3B3B3',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
    caption: {
        color: '#B3B3B3',
        fontSize: 12,
        marginBottom: 10,
    },
    contestedContainer: {
        width: '100%',
        backgroundColor: '#191414',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    listContainer: {
        width: '100%',
        backgroundColor: '#191414',
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
        marginTop: 10,
    },
    errorBox: {
        width: '100%',
        backgroundColor: '#2a1b1b',
        borderColor: '#ff6b6b',
        borderWidth: 1,
        borderRadius: 8,
        padding: 14,
    },
    errorTitle: {
        color: '#ff6b6b',
        fontWeight: '700',
        fontSize: 16,
        marginBottom: 6,
    },
    errorText: {
        color: '#ff9f9f',
        fontSize: 14,
    },
    errorHint: {
        color: '#ffcf9f',
        fontSize: 12,
        marginTop: 6,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 5,
    },
    rank: {
        color: '#FFFFFF',
        width: 24,
        fontWeight: '700',
        fontSize: 14,
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 4,
        marginRight: 10,
    },
    itemName: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    artistName: {
        color: '#B3B3B3',
        fontSize: 12,
    },
});
