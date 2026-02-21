import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyService } from '../services/spotify';
import { PairStack } from '../components/PairStack';
import { StrengthSlider } from '../components/StrengthSlider';
import { engineManager } from '../services/engineManager';
import { useEngineStatus } from '../hooks/useEngineStatus';

export default function VotingScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const [pair, setPair] = React.useState<any>(null);
    const { stabilityScore, status, refresh } = useEngineStatus();

    let label = status?.reason || 'Loading...';
    if (stabilityScore > 80) label = 'Almost there!';
    if (status?.canStop) label = 'Top 10 Locked In! Ready to export?';

    React.useEffect(() => {
        if (token) {
            startSession();
        }
    }, [token]);

    const startSession = async () => {
        // Mock user for now or fetch real one
        const user = await SpotifyService.getCurrentUser();

        // In a real app, you'd pick a playlist first. 
        // For MVP initialization, we'll assume a session is being resumed or started.
        // This logic will be refined in Plan 5.5.
        try {
            const engine = engineManager.getEngine();
            setPair(engine.nextPair());
            refresh();
        } catch {
            console.log("No engine active. Please pick a playlist.");
        }
    };

    const handleVote = async (strength: number) => {
        if (!pair) return;

        const engine = engineManager.getEngine();

        // Convert slider -1..1 to comparison result
        // -1 (Full Item A), 1 (Full Item B)
        const winnerId = strength < 0 ? pair.a : pair.b;
        const isDraw = Math.abs(strength) < 0.1;

        engine.ingest({
            a: pair.a,
            b: pair.b,
            result: isDraw ? 'tie' : (strength < 0 ? 'a' : 'b'),
            t: Date.now(),
        });

        await engineManager.save();
        setPair(engine.nextPair());
        refresh();
    };

    if (!token) {
        return (
            <View style={styles.centered}>
                <Button title="Connect Spotify" onPress={() => promptAsync()} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.stability}>Stability: {stabilityScore}%</Text>
            </View>

            {pair ? (
                <>
                    <PairStack
                        itemA={{ id: pair.a, name: "Loading..." }} // Metadata fetch to be added
                        itemB={{ id: pair.b, name: "Loading..." }}
                    />
                    <StrengthSlider onVote={handleVote} />
                </>
            ) : (
                <View style={styles.centered}>
                    <Text style={styles.label}>Select a playlist to start voting</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingTop: 60,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    label: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
    },
    stability: {
        color: '#1DB954',
        fontSize: 14,
        marginTop: 5,
    },
});
