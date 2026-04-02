import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSpotifyAuth } from '@/src/services/spotifyAuth';
import { Button } from '@/src/components/ui/Button';
import { Screen } from '@/src/components/ui/Screen';
import { theme } from '@/src/theme';

export default function SpotifyTab() {
    const { token, promptAsync, logout } = useSpotifyAuth();
    const connected = !!token;

    return (
        <Screen>
            <View style={styles.header}>
                <Text style={styles.title}>Spotify</Text>
            </View>
            <View style={styles.body}>
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
                        <Text style={styles.statusText}>
                            {connected ? 'Connected' : 'Not connected'}
                        </Text>
                    </View>
                    <Text style={styles.caption}>
                        {connected
                            ? 'Your Spotify account is linked. You can rank playlists and export results.'
                            : 'Connect your Spotify account to get started.'}
                    </Text>
                    <View style={styles.gap} />
                    {connected ? (
                        <View style={styles.btnRow}>
                            <Button
                                label="Disconnect"
                                onPress={logout}
                                kind="secondary"
                                style={styles.btnHalf}
                            />
                            <Button
                                label="Reconnect"
                                onPress={() => promptAsync()}
                                style={styles.btnHalf}
                            />
                        </View>
                    ) : (
                        <Button label="Connect Spotify" onPress={() => promptAsync()} />
                    )}
                </View>
            </View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: theme.spacing(8),
        paddingHorizontal: theme.spacing(5),
        paddingBottom: theme.spacing(4),
    },
    title: { ...theme.typography.title },
    body: {
        flex: 1,
        paddingHorizontal: theme.spacing(5),
    },
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing(5),
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing(3),
        gap: theme.spacing(2),
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotOn: { backgroundColor: theme.colors.accent },
    dotOff: { backgroundColor: theme.colors.textMuted },
    statusText: {
        ...theme.typography.subtitle,
        fontSize: 15,
    },
    caption: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    gap: { height: theme.spacing(4) },
    btnRow: {
        flexDirection: 'row',
        gap: theme.spacing(3),
    },
    btnHalf: { flex: 1 },
});
