import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Screen } from '../components/ui/Screen';
import { Header } from '../components/ui/Header';
import { theme } from '../theme';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { PlaylistsPage } from '../pages/PlaylistsPage';
import { PreviewPage } from '../pages/PreviewPage';
import { ItemMetadata } from '../services/engineManager';

type Page = 'playlists' | 'preview';

interface AppShellProps {
    onSelected: () => void;
}

export function AppShell({ onSelected }: AppShellProps) {
    const { token, logout } = useSpotifyAuth();
    const [page, setPage] = React.useState<Page>('playlists');
    const [previewTitle, setPreviewTitle] = React.useState('');
    const [previewTracks, setPreviewTracks] = React.useState<ItemMetadata[]>([]);

    const backIcon = <Text style={styles.backButton}>‹</Text>;

    const headerProps = page === 'preview'
        ? { title: previewTitle || 'Preview', leftIcon: backIcon, onLeftPress: () => setPage('playlists') }
        : { title: 'Select a Playlist' };

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
                    onAuthError={() => logout()}
                />
            )}

            {page === 'preview' && (
                <PreviewPage
                    title={previewTitle}
                    tracks={previewTracks}
                    onBack={() => setPage('playlists')}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    backButton: {
        color: theme.colors.accent,
        fontSize: 24,
        fontWeight: '700',
    },
});
