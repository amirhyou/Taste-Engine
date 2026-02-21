import React from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';
import { engineManager } from '../services/engineManager';
import { SpotifyExportService } from '../services/spotifyExport';

export default function ResultScreen({ onRestart }: { onRestart: () => void }) {
    const [exporting, setExporting] = React.useState(false);
    const [done, setDone] = React.useState(false);

    const handleExport = async () => {
        setExporting(true);
        try {
            const engine = engineManager.getEngine();
            // Assume we are exporting the top 10 for the current session
            await SpotifyExportService.exportResults(engine, 'active', 10);
            setDone(true);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Results Ready!</Text>
            <Text style={styles.subtitle}>Your top tracks have been identified.</Text>

            {exporting ? (
                <ActivityIndicator size="large" color="#1DB954" />
            ) : done ? (
                <View style={styles.success}>
                    <Text style={styles.successText}>✅ Playlist Created in Spotify!</Text>
                    <Button title="Start Fresh" onPress={onRestart} />
                </View>
            ) : (
                <View style={styles.actions}>
                    <Button title="Export to Spotify" onPress={handleExport} color="#1DB954" />
                    <Button title="Back to Voting" onPress={onRestart} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: 'bold',
    },
    subtitle: {
        color: '#B3B3B3',
        fontSize: 18,
        marginTop: 10,
        textAlign: 'center',
        marginBottom: 40,
    },
    actions: {
        width: '100%',
        gap: 15,
    },
    success: {
        alignItems: 'center',
        gap: 20,
    },
    successText: {
        color: '#1DB954',
        fontSize: 20,
        fontWeight: '600',
    },
});
