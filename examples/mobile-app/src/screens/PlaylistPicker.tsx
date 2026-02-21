import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SpotifyService } from '../services/spotify';
import { engineManager, ItemMetadata } from '../services/engineManager';

export default function PlaylistPicker({ onSelected }: { onSelected: () => void }) {
    const [playlists, setPlaylists] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        loadPlaylists();
    }, []);

    const loadPlaylists = async () => {
        try {
            const data = await SpotifyService.getPlaylists();
            setPlaylists(data.items || []);
        } catch (error) {
            console.error('Failed to load playlists:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (playlist: any) => {
        setLoading(true);
        try {
            const trackData = await SpotifyService.getPlaylistTracks(playlist.id);

            const itemIds: string[] = [];
            const metadata: Record<string, ItemMetadata> = {};

            trackData.items.forEach((item: any) => {
                if (item.track) {
                    itemIds.push(item.track.id);
                    metadata[item.track.id] = {
                        name: item.track.name,
                        artist: item.track.artists?.[0]?.name,
                        imageUrl: item.track.album?.images?.[0]?.url,
                    };
                }
            });

            await engineManager.init(playlist.id, itemIds, metadata);
            onSelected();
        } catch (error) {
            console.error('Failed to start session:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && playlists.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#1DB954" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Pick a Playlist</Text>
            <FlatList
                data={playlists}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.item} onPress={() => handleSelect(item)}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemTracks}>{item.tracks.total} tracks</Text>
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
        padding: 20,
        paddingTop: 60,
    },
    centered: {
        flex: 1,
        backgroundColor: '#121212',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    item: {
        backgroundColor: '#282828',
        padding: 20,
        borderRadius: 10,
        marginBottom: 10,
    },
    itemName: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    itemTracks: {
        color: '#B3B3B3',
        fontSize: 14,
        marginTop: 5,
    },
});
