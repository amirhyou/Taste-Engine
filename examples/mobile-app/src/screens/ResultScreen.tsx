import React from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Linking } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyExportService } from '../services/spotifyExport';
import { engineManager } from '../services/engineManager';
import { sessionManager } from '../services/sessionManager';

interface ResultScreenProps {
    onRestart: () => void;
}

export default function ResultScreen({ onRestart }: ResultScreenProps) {
    const { token } = useSpotifyAuth();
    const [exporting, setExporting] = React.useState(false);
    const [result, setResult] = React.useState<{ success: boolean; url?: string } | null>(null);

    const handleExport = async () => {
        setExporting(true);
        try {
            const engine = engineManager.getEngine();
            const res = await SpotifyExportService.exportResults(token!, engine);
            setResult({ success: true, url: res.external_urls.spotify });

            // Archive session on completion
            const playlistId = engineManager.getCurrentPlaylistId();
            if (playlistId) {
                sessionManager.archiveSession(playlistId);
            }
        } catch (err) {
            console.error('Export failed', err);
            setResult({ success: false });
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
        <View style={styles.centered}>
            <Text style={styles.title}>Session Complete</Text>
            <Text style={styles.text}>You have reached a stable ranking.</Text>
            <View style={{ marginVertical: 30, width: '80%' }}>
                <Button title="Export to Spotify" onPress={handleExport} color="#1DB954" />
            </View>
            <Button title="Go Back" onPress={onRestart} color="#666" />
        </View>
    );
}

const styles = StyleSheet.create({
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
    text: {
        color: '#B3B3B3',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
    },
});
