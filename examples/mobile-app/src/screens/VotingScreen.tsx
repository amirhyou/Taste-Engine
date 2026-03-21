import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyService } from '../services/spotify';
import { PairStack } from '../components/PairStack';
import { StrengthSlider } from '../components/StrengthSlider';
import { engineManager } from '../services/engineManager';
import { sessionController } from '../services/sessionController';
import { Screen } from '../components/ui/Screen';
import { theme } from '../theme';

import ResultScreen from './ResultScreen';
import { AppShell } from '../layout/AppShell';

export default function VotingScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const [view, setView] = React.useState<'picker' | 'voter' | 'results'>('picker');
    const [pair, setPair] = React.useState<any>(null);
    const [stability, setStability] = React.useState(0);
    const [message, setMessage] = React.useState('Loading...');

    React.useEffect(() => {
        if (token) {
            // Check if we have an active engine and skip picker
            try {
                engineManager.getEngine();
                sessionController.init();
                setPair(sessionController.getActivePair());
                setStability(sessionController.getStability());
                setMessage(sessionController.getStatusMessage());
                setView('voter');
            } catch {
                setView('picker');
            }
        }
    }, [token]);

    const handlePlaylistSelected = () => {
        sessionController.init();
        setPair(sessionController.getActivePair());
        setStability(sessionController.getStability());
        setMessage(sessionController.getStatusMessage());
        setView('voter');
    };

    const handleVote = async (strength: number) => {
        if (!pair) return;

        await sessionController.ingest(strength);

        const next = sessionController.getActivePair();
        if (!next) {
            setView('results');
        } else {
            setPair(next);
            setStability(sessionController.getStability());
            setMessage(sessionController.getStatusMessage());
        }
    };

    if (!token) {
        return (
            <Screen>
                <View style={styles.centered}>
                    <Button title="Connect Spotify" onPress={() => promptAsync()} />
                </View>
            </Screen>
        );
    }

    if (view === 'picker') {
        return <AppShell onSelected={handlePlaylistSelected} />;
    }

    if (view === 'results') {
        return <ResultScreen onRestart={() => setView('picker')} />;
    }

    return (
        <Screen>
            <View style={styles.header}>
                <Text style={styles.label}>{message}</Text>
                <Text style={styles.stability}>Stability: {stability}%</Text>
            </View>

            {pair ? (
                <>
                    <PairStack
                        itemA={sessionController.getMetadata(pair.a)}
                        itemB={sessionController.getMetadata(pair.b)}
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
        </Screen>
    );
}

const styles = StyleSheet.create({
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
        paddingTop: theme.spacing(12),
        paddingHorizontal: theme.spacing(5),
        alignItems: 'center',
    },
    label: {
        color: theme.colors.textPrimary,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
    },
    stability: {
        color: theme.colors.accent,
        fontSize: 14,
        marginTop: 5,
    },
});
