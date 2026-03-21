import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '../components/ui/Button';
import { theme } from '../theme';

interface SpotifyPageProps {
    token: string | null;
    onConnect: () => void;
    onDisconnect: () => void;
}

export function SpotifyPage({ token, onConnect, onDisconnect }: SpotifyPageProps) {
    const connected = !!token;
    return (
        <View style={styles.container}>
            <View style={styles.statusCard}>
                <Text style={styles.statusText}>
                    {connected ? 'Connected to Spotify.' : 'Not connected to Spotify.'}
                </Text>
                <View style={{ height: theme.spacing(3) }} />
                {connected ? (
                    <View style={styles.rowBetween}>
                        <Button label="Disconnect" onPress={onDisconnect} kind="secondary" style={{ flex: 1, marginRight: theme.spacing(2) }} />
                        <Button label="Refresh Connection" onPress={onConnect} style={{ flex: 1, marginLeft: theme.spacing(2) }} />
                    </View>
                ) : (
                    <Button label="Connect Spotify" onPress={onConnect} />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: theme.spacing(4),
    },
    statusCard: {
        padding: theme.spacing(4),
        borderRadius: 12,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    statusText: {
        color: theme.colors.textPrimary,
        fontSize: 16,
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
});
