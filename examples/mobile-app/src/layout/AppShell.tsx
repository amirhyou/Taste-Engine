import React from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Screen } from '../components/ui/Screen';
import { Header } from '../components/ui/Header';
import { theme } from '../theme';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { PlaylistsPage } from '../pages/PlaylistsPage';
import { SpotifyPage } from '../pages/SpotifyPage';
import { PreviewPage } from '../pages/PreviewPage';
import { ItemMetadata } from '../services/engineManager';

type Page = 'playlists' | 'spotify' | 'preview';

interface AppShellProps {
    onSelected: () => void;
}

export function AppShell({ onSelected }: AppShellProps) {
    const { token, promptAsync, logout } = useSpotifyAuth();
    const [page, setPage] = React.useState<Page>('playlists');
    const [menuOpen, setMenuOpen] = React.useState(false);
    const menuX = React.useRef(new Animated.Value(-260)).current;
    const overlayOpacity = React.useRef(new Animated.Value(0)).current;

    const [previewTitle, setPreviewTitle] = React.useState('');
    const [previewTracks, setPreviewTracks] = React.useState<ItemMetadata[]>([]);

    const hamburger = (
        <View style={styles.hamburger}>
            <View style={styles.bar} />
            <View style={styles.bar} />
            <View style={styles.bar} />
        </View>
    );

    const openMenu = () => {
        setMenuOpen(true);
        Animated.parallel([
            Animated.timing(menuX, { toValue: 0, duration: 180, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 0.45, duration: 180, useNativeDriver: true }),
        ]).start();
    };

    const closeMenu = () => {
        Animated.parallel([
            Animated.timing(menuX, { toValue: -260, duration: 180, useNativeDriver: true }),
            Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => setMenuOpen(false));
    };

    const headerProps =
        page === 'preview'
            ? { title: previewTitle || 'Preview', leftIcon: <Text style={styles.backButton}>‹</Text>, onLeftPress: () => setPage('playlists') }
            : { title: page === 'spotify' ? 'Spotify' : 'Select a Playlist', leftIcon: hamburger, onLeftPress: openMenu };

    return (
        <Screen>
            <Header {...headerProps} />

            {page === 'playlists' && (
                <PlaylistsPage
                    token={token}
                    onSelected={onSelected}
                    onPreview={(title, tracks) => {
                        setPreviewTitle(title);
                        setPreviewTracks(tracks);
                        setPage('preview');
                    }}
                    onAuthError={() => {
                        logout();
                        setPage('spotify');
                    }}
                />
            )}

            {page === 'spotify' && (
                <SpotifyPage
                    token={token}
                    onConnect={promptAsync}
                    onDisconnect={logout}
                />
            )}

            {page === 'preview' && (
                <PreviewPage
                    title={previewTitle}
                    tracks={previewTracks}
                    onBack={() => setPage('playlists')}
                />
            )}

            {/* Drawer */}
            {menuOpen && (
                <Animated.View style={[styles.menuOverlay, { opacity: overlayOpacity }]} pointerEvents="auto">
                    <TouchableOpacity style={{ flex: 1 }} onPress={closeMenu} />
                </Animated.View>
            )}
            <Animated.View
                style={[
                    styles.menuPanel,
                    { transform: [{ translateX: menuX }] },
                    { pointerEvents: 'auto' },
                ]}
            >
                <Text style={styles.menuTitle}>Menu</Text>
                {token && (
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                            setPage('playlists');
                            closeMenu();
                        }}
                    >
                        <Text style={styles.menuItemText}>My Playlists</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                        setPage('spotify');
                        closeMenu();
                    }}
                >
                    <Text style={styles.menuItemText}>Spotify</Text>
                </TouchableOpacity>
            </Animated.View>
        </Screen>
    );
}

const styles = StyleSheet.create({
    hamburger: {
        width: 24,
        justifyContent: 'space-between',
        height: 18,
    },
    bar: {
        height: 2,
        backgroundColor: theme.colors.textPrimary,
        borderRadius: 1,
    },
    backButton: {
        color: theme.colors.accent,
        fontSize: 18,
        fontWeight: '700',
    },
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.overlay,
    },
    menuPanel: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 240,
        backgroundColor: theme.colors.surface,
        padding: 16,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
    },
    menuTitle: {
        color: theme.colors.textPrimary,
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
    },
    menuItem: {
        paddingVertical: 10,
    },
    menuItemText: {
        color: theme.colors.textPrimary,
        fontSize: 16,
    },
});
