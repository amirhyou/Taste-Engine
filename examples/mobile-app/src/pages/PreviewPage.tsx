import React from 'react';
import { ScrollView, Text, StyleSheet, Alert } from 'react-native';
import { ListItem } from '../components/ui/ListItem';
import { ItemMetadata } from '../services/engineManager';
import { SpotifyService } from '../services/spotify';
import { theme } from '../theme';
import { audioPreview } from '../services/audioPreview';

interface PreviewPageProps {
    title: string;
    tracks: ItemMetadata[];
    onBack: () => void;
}

export function PreviewPage({ title, tracks }: PreviewPageProps) {
    const [items, setItems] = React.useState<ItemMetadata[]>(tracks);
    const previewFallbackLimit = 20;

    React.useEffect(() => {
        setItems(tracks);
        let cancelled = false;
        const timer = setTimeout(() => {
            (async () => {
                let filled = 0;
                const next = tracks.map((t) => ({ ...t }));
                for (let i = 0; i < next.length; i++) {
                    if (filled >= previewFallbackLimit) break;
                    const item = next[i];
                    if (item.previewUrl || !item.name) continue;
                    const preview = await SpotifyService.searchTrackPreview(item.name, item.artist);
                    if (preview) {
                        next[i] = { ...item, previewUrl: preview };
                        filled += 1;
                        if (filled % 3 === 0 && !cancelled) {
                            setItems([...next]);
                        }
                    }
                }
                if (!cancelled && filled > 0) {
                    setItems([...next]);
                }
            })();
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [tracks]);

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
            {items.map((t, idx) => (
                <ListItem
                    key={t.id || idx}
                    title={`${idx + 1}. ${t.name}`}
                    subtitle={t.artist || 'Unknown artist'}
                    imageUrl={t.imageUrl}
                    onPlayPress={() => handlePlay((t as any).previewUrl)}
                    canPlay={!!(t as any).previewUrl}
                />
            ))}
            {items.length === 0 && <Text style={styles.text}>No tracks available.</Text>}
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
