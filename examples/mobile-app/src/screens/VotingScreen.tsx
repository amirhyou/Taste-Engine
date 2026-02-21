import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyService } from '../services/spotify';
import { PairStack } from '../components/PairStack';
import { StrengthSlider } from '../components/StrengthSlider';
import { engineManager } from '../services/engineManager';
import { useEngineStatus } from '../hooks/useEngineStatus';

import ResultScreen from './ResultScreen';
import PlaylistPicker from './PlaylistPicker';

export default function VotingScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const [view, setView] = React.useState<'picker' | 'voter' | 'results'>('picker');
    const [pair, setPair] = React.useState<any>(null);
    const { stabilityScore, status, refresh } = useEngineStatus();

    let label = status?.reason || 'Loading...';
    if (stabilityScore > 80) label = 'Almost there!';
    if (status?.canStop) label = 'Top 10 Locked In! Ready to export?';

    React.useEffect(() => {
        if (token) {
            // Check if we have an active engine and skip picker
            try {
                const engine = engineManager.getEngine();
                setPair(engine.nextPair());
                setView('voter');
                refresh();
            } catch {
                setView('picker');
            }
        }
    }, [token]);

    const handlePlaylistSelected = () => {
        const engine = engineManager.getEngine();
        setPair(engine.nextPair());
        setView('voter');
        refresh();
    };

    const handleVote = async (strength: number) => {
        if (!pair) return;

        const engine = engineManager.getEngine();
        const winnerId = strength < 0 ? pair.a : pair.b;
        const isDraw = Math.abs(strength) < 0.1;

        engine.ingest({
            a: pair.a,
            b: pair.b,
            result: isDraw ? 'tie' : (strength < 0 ? 'a' : 'b'),
            t: Date.now(),
        });

        await engineManager.save();

        const next = engine.nextPair();
        if (!next) {
            setView('results');
        } else {
            setPair(next);
        }
        refresh();
    };

    if (!token) {
        return (
            <View style={styles.centered}>
                <Button title="Connect Spotify" onPress={() => promptAsync()} />
            </View>
        );
    }

    if (view === 'picker') {
        return <PlaylistPicker onSelected={handlePlaylistSelected} />;
    }

    if (view === 'results') {
        return <ResultScreen onRestart={() => setView('picker')} />;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{message}</Text>
                <Text style={styles.stability}>Stability: {stability}%</Text>
            </View>

            {pair ? (
                <>
                    <PairStack
                        itemA={engineManager.getMetadata(pair.a)}
                        itemB={engineManager.getMetadata(pair.b)}
                    />
                    <StrengthSlider onVote={handleVote} />
                    <View style={styles.footer}>
                        <Button title="Exit Session" onPress={() => setView('picker')} color="#FF5555" />
                        <Button title="View Results" onPress={() => setView('results')} color="#1DB954" />
                    </View>
                </>
            ) : (
                <View style={styles.centered}>
                    <Text style={styles.label}>All pairs compared!</Text>
                    <Button title="View Results" onPress={() => setView('results')} />
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
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingBottom: 40,
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
