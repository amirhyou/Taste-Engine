import React from 'react';
import { ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { ListItem } from '../components/ui/ListItem';
import { ItemMetadata } from '../services/engineManager';
import { theme } from '../theme';
import { audioPreview } from '../services/audioPreview';

interface PreviewPageProps {
    title: string;
    tracks: ItemMetadata[];
    onBack: () => void;
}

export function PreviewPage({ title, tracks }: PreviewPageProps) {
    const handlePlay = async (url?: string) => {
        if (!url) {
            Alert.alert('No preview available');
            return;
        }
        try {
            await audioPreview.play(url);
        } catch (err) {
            Alert.alert('Playback failed', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    return (
        <ScrollView style={{ paddingHorizontal: theme.spacing(4) }}>
            {tracks.map((t, idx) => (
                <ListItem
                    key={t.id || idx}
                    title={`${idx + 1}. ${t.name}`}
                    subtitle={t.artist || 'Unknown artist'}
                    imageUrl={t.imageUrl}
                    onPlayPress={() => handlePlay((t as any).previewUrl)}
                    canPlay={!!(t as any).previewUrl}
                />
            ))}
            {tracks.length === 0 && <Text style={styles.text}>No tracks available.</Text>}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    text: {
        color: theme.colors.textPrimary,
        marginTop: theme.spacing(2),
        textAlign: 'center',
    },
});
