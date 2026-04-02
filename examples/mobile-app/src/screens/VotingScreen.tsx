import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { PairStack } from '../components/PairStack';
import { StrengthSlider } from '../components/StrengthSlider';
import { engineManager } from '../services/engineManager';
import { sessionController } from '../services/sessionController';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { theme } from '../theme';

import ResultScreen from './ResultScreen';
import { AppShell } from '../layout/AppShell';

export default function VotingScreen() {
    const { token, promptAsync } = useSpotifyAuth();
    const [view, setView] = React.useState<'picker' | 'voter' | 'results'>('picker');
    const [pair, setPair] = React.useState<any>(null);
    const [stability, setStability] = React.useState(0);
    const [message, setMessage] = React.useState('Loading...');
    const voteInFlight = React.useRef(false);

    React.useEffect(() => {
        if (token) {
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
        if (!pair || voteInFlight.current) return;
        voteInFlight.current = true;
        try {
            await sessionController.ingest(strength);
            const next = sessionController.getActivePair();
            if (!next) {
                setView('results');
            } else {
                setPair(next);
                setStability(sessionController.getStability());
                setMessage(sessionController.getStatusMessage());
            }
        } finally {
            voteInFlight.current = false;
        }
    };

    if (!token) {
        return (
            <Screen>
                <View style={styles.centered}>
                    <Text style={styles.connectTitle}>Tastify</Text>
                    <Text style={styles.connectSubtitle}>Rank your music with AI-powered pairwise voting</Text>
                    <Button label="Connect Spotify" onPress={() => promptAsync()} style={styles.connectBtn} />
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
                        <Button label="Exit" onPress={() => setView('picker')} kind="secondary" style={styles.footerBtn} />
                        <Button label="View Results" onPress={() => setView('results')} style={styles.footerBtn} />
                    </View>
                </>
            ) : (
                <View style={styles.centered}>
                    <Text style={styles.label}>All pairs compared!</Text>
                    <View style={{ height: theme.spacing(4) }} />
                    <Button label="View Results" onPress={() => setView('results')} />
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing(8),
    },
    connectTitle: {
        ...theme.typography.title,
        fontSize: 32,
        marginBottom: theme.spacing(3),
    },
    connectSubtitle: {
        color: theme.colors.textSecondary,
        fontSize: 15,
        textAlign: 'center',
        marginBottom: theme.spacing(8),
        lineHeight: 22,
    },
    connectBtn: {
        width: '100%',
    },
    header: {
        paddingTop: theme.spacing(12),
        paddingHorizontal: theme.spacing(5),
        alignItems: 'center',
        paddingBottom: theme.spacing(2),
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
        marginTop: theme.spacing(1),
    },
    footer: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing(5),
        paddingBottom: theme.spacing(10),
        gap: theme.spacing(3),
    },
    footerBtn: {
        flex: 1,
    },
});
