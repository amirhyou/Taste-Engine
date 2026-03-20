import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ItemMetadata } from '../services/engineManager';

interface PairStackProps {
    itemA: ItemMetadata;
    itemB: ItemMetadata;
}

const TrackCard: React.FC<{ item: ItemMetadata; animKey: string }> = ({ item, animKey }) => (
    <Animated.View
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(400)}
        key={animKey}
        style={styles.card}
    >
        {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.albumArt} />
        ) : (
            <View style={styles.albumArtPlaceholder} />
        )}
        <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.artistName} numberOfLines={1}>{item.artist ?? '—'}</Text>
            <Text style={styles.albumName} numberOfLines={1}>{item.album ?? '—'}</Text>
        </View>
    </Animated.View>
);

export const PairStack: React.FC<PairStackProps> = ({ itemA, itemB }) => {
    return (
        <View style={styles.container}>
            <TrackCard item={itemA} animKey={`a-${itemA.id}`} />
            <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
            </View>
            <TrackCard item={itemB} animKey={`b-${itemB.id}`} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
        paddingHorizontal: 12,
        paddingVertical: 16,
        gap: 8,
    },
    card: {
        flex: 1,
        backgroundColor: '#191414',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1DB954',
        overflow: 'hidden',
    },
    albumArt: {
        width: '100%',
        aspectRatio: 1,
    },
    albumArtPlaceholder: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#282828',
    },
    trackInfo: {
        padding: 12,
        flex: 1,
        justifyContent: 'flex-start',
    },
    trackName: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    artistName: {
        color: '#1DB954',
        fontSize: 13,
        marginBottom: 2,
    },
    albumName: {
        color: '#B3B3B3',
        fontSize: 12,
    },
    vsContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 28,
    },
    vsText: {
        color: '#B3B3B3',
        fontSize: 16,
        fontWeight: '900',
    },
});
