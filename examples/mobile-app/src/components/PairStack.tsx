import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { ItemMetadata } from '../services/engineManager';

interface PairStackProps {
    itemA: ItemMetadata;
    itemB: ItemMetadata;
}

export const PairStack: React.FC<PairStackProps> = ({ itemA, itemB }) => {
    return (
        <View style={styles.container}>
            <Animated.View
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(400)}
                layout={LinearTransition}
                key={`a-${itemA.id}`}
                style={[styles.card, styles.topCard]}
            >
                <Text style={styles.itemName}>{itemA.name}</Text>
                <Text style={styles.artistName}>{itemA.artist}</Text>
            </Animated.View>

            <View style={styles.vsContainer}>
                <Text style={styles.vsText}>VS</Text>
            </View>

            <Animated.View
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(400)}
                layout={LinearTransition}
                key={`b-${itemB.id}`}
                style={[styles.card, styles.bottomCard]}
            >
                <Text style={styles.itemName}>{itemB.name}</Text>
                <Text style={styles.artistName}>{itemB.artist}</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-around',
        padding: 20,
    },
    card: {
        height: '40%',
        backgroundColor: '#1DB954', // Spotify Green for now
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
        padding: 20,
    },
    topCard: {
        backgroundColor: '#191414', // Dark
        borderWidth: 1,
        borderColor: '#1DB954',
    },
    bottomCard: {
        backgroundColor: '#191414',
        borderWidth: 1,
        borderColor: '#1DB954',
    },
    itemName: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    artistName: {
        color: '#B3B3B3',
        fontSize: 18,
        marginTop: 10,
        textAlign: 'center',
    },
    vsContainer: {
        alignItems: 'center',
        marginVertical: 10,
    },
    vsText: {
        color: '#B3B3B3',
        fontSize: 20,
        fontWeight: '900',
    },
});
