import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { SpotifyService } from '../services/spotify';
import { engineManager, ItemMetadata } from '../services/engineManager';
import { sessionManager } from '../services/sessionManager';

interface PlaylistPickerProps {
    onSelected: () => void;
}

export default function PlaylistPicker({ onSelected }: PlaylistPickerProps) {
    const { token } = useSpotifyAuth();
    const [playlists, setPlaylists] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [targetK, setTargetK] = React.useState(20);

    React.useEffect(() => {
        if (token) {
            SpotifyService.getUserPlaylists(token)
                .then(setPlaylists)
                .finally(() => setLoading(false));
        }
    }, [token]);

    const handleSelect = async (playlist: any) => {
        setLoading(true);
        try {
            const tracks = await SpotifyService.getPlaylistTracks(token!, playlist.id);
            const itemIds = tracks.map((t: any) => t.id);
            const metadata: Record<string, ItemMetadata> = {};
            tracks.forEach((t: any) => {
                metadata[t.id] = {
                    id: t.id,
                    name: t.name,
                    artist: t.artists?.[0]?.name,
                    imageUrl: t.album?.images?.[0]?.url,
                };
            });

            await engineManager.init(playlist.id, itemIds, targetK, metadata);
            sessionManager.registerSession(playlist.id, playlist.name, targetK);
            onSelected();
        } catch (err) {
            console.error('Failed to load playlist', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1DB954" />
                <Text style={styles.text}>Loading your playlists...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Select a Playlist</Text>

            <View style={styles.kPicker}>
                <Text style={styles.kLabel}>Target: Top {targetK}</Text>
                <View style={[styles.row, { justifyContent: 'space-around', marginVertical: 10 }]}>
                    {[10, 20, 50, 100].map(k => (
                        <TouchableOpacity
                            key={k}
                            onPress={() => setTargetK(k)}
                            style={[styles.kButton, targetK === k && styles.kButtonActive]}
                        >
                            <Text style={[styles.kButtonText, targetK === k && styles.kButtonTextActive]}>{k}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.playlistItem} onPress={() => handleSelect(item)}>
                        <Text style={styles.playlistName}>{item.name}</Text>
                        <Text style={styles.playlistSongs}>{item.tracks.total} songs</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        paddingTop: 60,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    text: {
        color: '#FFFFFF',
        marginTop: 10,
    },
    playlistItem: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    playlistName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    playlistSongs: {
        color: '#B3B3B3',
        fontSize: 14,
        marginTop: 4,
    },
    kPicker: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    kLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
    },
    kButton: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1DB954',
    },
    kButtonActive: {
        backgroundColor: '#1DB954',
    },
    kButtonText: {
        color: '#1DB954',
        fontWeight: 'bold',
    },
    kButtonTextActive: {
        color: '#FFFFFF',
    },
});
