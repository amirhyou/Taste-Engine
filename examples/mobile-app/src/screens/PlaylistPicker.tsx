import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SpotifyService } from '../services/spotify';
import { engineManager, ItemMetadata } from '../services/engineManager';

export default function PlaylistPicker({ onSelected }: { onSelected: () => void }) {
    const [playlists, setPlaylists] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedPlaylist, setSelectedPlaylist] = React.useState<any>(null);
    const [targetK, setTargetK] = React.useState<number>(10);

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

    const handleStart = async () => {
        if (!selectedPlaylist) return;
        setLoading(true);
        try {
            const trackData = await SpotifyService.getPlaylistTracks(selectedPlaylist.id);

            const itemIds: string[] = [];
            const metadata: Record<string, ItemMetadata> = {};

            trackData.items.forEach((item: any) => {
                if (item.track) {
                    itemIds.push(item.track.id);
                    metadata[item.track.id] = {
                        id: item.track.id,
                        name: item.track.name,
                        artist: item.track.artists?.[0]?.name,
                        imageUrl: item.track.album?.images?.[0]?.url,
                    };
                }
            });

            await engineManager.init(selectedPlaylist.id, itemIds, targetK, metadata);
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

    if (selectedPlaylist) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Target Ranking</Text>
                <Text style={styles.subtitle}>Choose how many items you want to rank from "{selectedPlaylist.name}"</Text>

                <View style={styles.kOptions}>
                    {[10, 20, 50, 100].map(k => (
                        <TouchableOpacity
                            key={k}
                            style={[styles.kButton, targetK === k && styles.kButtonActive]}
                            onPress={() => setTargetK(k)}
                        >
                            <Text style={[styles.kText, targetK === k && styles.kTextActive]}>Top {k}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={styles.startButton} onPress={handleStart}>
                    <Text style={styles.startButtonText}>Start Ranking</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.backButton} onPress={() => setSelectedPlaylist(null)}>
                    <Text style={styles.backButtonText}>Back to Playlists</Text>
                </TouchableOpacity>
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
                    <TouchableOpacity style={styles.item} onPress={() => setSelectedPlaylist(item)}>
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
        marginBottom: 10,
    },
    subtitle: {
        color: '#B3B3B3',
        fontSize: 16,
        marginBottom: 30,
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
    kOptions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    kButton: {
        width: '48%',
        backgroundColor: '#282828',
        padding: 20,
        borderRadius: 10,
        marginBottom: 15,
        alignItems: 'center',
    },
    kButtonActive: {
        backgroundColor: '#1DB954',
    },
    kText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    kTextActive: {
        color: '#000000',
    },
    startButton: {
        backgroundColor: '#1DB954',
        padding: 20,
        borderRadius: 30,
        alignItems: 'center',
        marginBottom: 20,
    },
    startButtonText: {
        color: '#000000',
        fontSize: 18,
        fontWeight: 'bold',
    },
    backButton: {
        alignItems: 'center',
    },
    backButtonText: {
        color: '#B3B3B3',
        fontSize: 16,
    },
});
