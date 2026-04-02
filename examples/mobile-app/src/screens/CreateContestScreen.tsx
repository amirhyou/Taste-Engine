import React from 'react';
import {
    View, Text, StyleSheet, TextInput, ActivityIndicator,
    ScrollView, Image, Share, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { socialApi } from '../services/socialApi';
import { PlaylistPickerPage, PickedPlaylist } from '../pages/PlaylistPickerPage';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { myContestsStore } from '../services/myContests';
import { theme } from '../theme';

type Phase = 'pick' | 'configure' | 'created';

interface CreatedState {
    contestId: string;
    inviteCode: string;
    published: boolean;
}

export function CreateContestScreen() {
    const router = useRouter();
    const { token, promptAsync } = useSpotifyAuth();
    const [phase, setPhase] = React.useState<Phase>('pick');
    const [picked, setPicked] = React.useState<PickedPlaylist | null>(null);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [creating, setCreating] = React.useState(false);
    const [publishing, setPublishing] = React.useState(false);
    const [created, setCreated] = React.useState<CreatedState | null>(null);

    const handlePicked = (result: PickedPlaylist) => {
        setPicked(result);
        setTitle(result.playlistName);
        setPhase('configure');
    };

    const handleCreate = async () => {
        if (!picked) return;
        setCreating(true);
        try {
            const result = await socialApi.createContest({
                items: picked.trackIds,
                itemMeta: picked.trackMeta,
                title: title.trim() || picked.playlistName,
                description: description.trim() || undefined,
            });
            setCreated({ contestId: result.contestId, inviteCode: result.inviteCode, published: false });
            setPhase('created');
            await myContestsStore.add({
                id: result.contestId,
                title: title.trim() || picked.playlistName,
                inviteCode: result.inviteCode,
                published: false,
                closed: false,
            });
        } catch (e) {
            Alert.alert('Failed to create contest', e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setCreating(false);
        }
    };

    const handleSharePrivate = async () => {
        if (!created) return;
        try {
            await Share.share({
                message: `Join my Tastify contest!\nInvite code: ${created.inviteCode}\n\nOpen Tastify → Contests → Join with Code`,
                title: 'Join my Tastify Contest',
            });
        } catch { /* user cancelled */ }
    };

    const handlePublish = async () => {
        if (!created) return;
        setPublishing(true);
        try {
            await socialApi.publishContest(created.contestId);
            setCreated(prev => prev ? { ...prev, published: true } : prev);
            await myContestsStore.setPublished(created.contestId, true);
        } catch (e) {
            Alert.alert('Failed to publish', e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setPublishing(false);
        }
    };

    const handleViewContest = () => {
        if (!created) return;
        router.replace({ pathname: '/(tabs)/contests/[id]', params: { id: created.contestId } } as any);
    };

    // Phase: pick playlist
    if (phase === 'pick') {
        if (!token) {
            return (
                <Screen>
                    <View style={styles.header}>
                        <Button label="← Back" onPress={() => router.back()} kind="secondary" style={styles.backBtn} />
                        <Text style={styles.title}>New Contest</Text>
                    </View>
                    <View style={styles.centered}>
                        <Text style={styles.bodyText}>Connect Spotify to pick a playlist</Text>
                        <View style={styles.gap} />
                        <Button label="Connect Spotify" onPress={() => promptAsync()} />
                    </View>
                </Screen>
            );
        }
        return (
            <Screen>
                <View style={styles.pickHeader}>
                    <Button label="← Back" onPress={() => router.back()} kind="secondary" style={styles.backBtn} />
                    <Text style={styles.title}>Pick a Playlist</Text>
                </View>
                <PlaylistPickerPage
                    token={token}
                    onSelected={handlePicked}
                    onAuthError={() => router.back()}
                />
            </Screen>
        );
    }

    // Phase: configure
    if (phase === 'configure' && picked) {
        return (
            <Screen>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={styles.header}>
                        <Button label="← Back" onPress={() => setPhase('pick')} kind="secondary" style={styles.backBtn} />
                        <Text style={styles.title}>Create Contest</Text>
                    </View>

                    <View style={styles.playlistPreview}>
                        {picked.imageUrl
                            ? <Image source={{ uri: picked.imageUrl }} style={styles.playlistImage} />
                            : <View style={styles.playlistImagePlaceholder} />
                        }
                        <View style={styles.playlistInfo}>
                            <Text style={styles.playlistName}>{picked.playlistName}</Text>
                            <Text style={styles.trackCount}>{picked.trackIds.length} tracks</Text>
                        </View>
                    </View>

                    <Text style={styles.fieldLabel}>Title</Text>
                    <TextInput
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Contest title"
                        placeholderTextColor={theme.colors.textMuted}
                        maxLength={100}
                    />

                    <Text style={styles.fieldLabel}>Description (optional)</Text>
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What's this contest about?"
                        placeholderTextColor={theme.colors.textMuted}
                        multiline
                        numberOfLines={3}
                        maxLength={300}
                    />

                    <View style={styles.gap} />

                    {creating ? (
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color={theme.colors.accent} />
                            <Text style={styles.loadingText}>Creating contest...</Text>
                        </View>
                    ) : (
                        <Button label="Create Contest" onPress={handleCreate} />
                    )}
                </ScrollView>
            </Screen>
        );
    }

    // Phase: created
    if (phase === 'created' && created) {
        return (
            <Screen>
                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={styles.successIcon}>
                        <Text style={styles.successEmoji}>🏆</Text>
                    </View>
                    <Text style={styles.title}>Contest Created!</Text>
                    <Text style={styles.bodyText}>Share it with friends or make it public so anyone can discover it.</Text>

                    <View style={styles.codeBox}>
                        <Text style={styles.codeLabel}>Invite Code</Text>
                        <Text style={styles.codeValue}>{created.inviteCode}</Text>
                    </View>

                    <Button label="Share Invite Link" onPress={handleSharePrivate} style={styles.actionBtn} />

                    {created.published ? (
                        <View style={styles.publishedBadge}>
                            <Text style={styles.publishedText}>Public — visible in Discover</Text>
                        </View>
                    ) : (
                        <Button
                            label={publishing ? 'Publishing...' : 'Make Public (Discoverable)'}
                            onPress={handlePublish}
                            kind="secondary"
                            style={styles.actionBtn}
                        />
                    )}

                    <View style={styles.gap} />
                    <Button label="View Contest & Vote" onPress={handleViewContest} style={styles.actionBtn} />
                    <Button label="Done" onPress={() => router.back()} kind="secondary" style={styles.actionBtn} />
                </ScrollView>
            </Screen>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    scroll: {
        padding: theme.spacing(5),
        paddingTop: theme.spacing(8),
    },
    header: {
        marginBottom: theme.spacing(5),
    },
    pickHeader: {
        paddingHorizontal: theme.spacing(5),
        paddingTop: theme.spacing(8),
        marginBottom: theme.spacing(3),
    },
    backBtn: {
        alignSelf: 'flex-start',
        marginBottom: theme.spacing(3),
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(2),
    },
    title: {
        ...theme.typography.title,
    },
    centered: { alignItems: 'center', paddingVertical: theme.spacing(10) },
    bodyText: { color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center' },
    gap: { height: theme.spacing(4) },
    loadingText: { color: theme.colors.textSecondary, marginTop: theme.spacing(3) },
    playlistPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: theme.radius.md,
        padding: theme.spacing(3),
        marginBottom: theme.spacing(5),
        gap: theme.spacing(3),
    },
    playlistImage: { width: 56, height: 56, borderRadius: theme.radius.sm },
    playlistImagePlaceholder: {
        width: 56, height: 56, borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surface,
    },
    playlistInfo: { flex: 1 },
    playlistName: { ...theme.typography.subtitle, marginBottom: 2 },
    trackCount: { color: theme.colors.textSecondary, fontSize: 13 },
    fieldLabel: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: theme.spacing(2),
        marginTop: theme.spacing(4),
    },
    input: {
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        color: theme.colors.textPrimary,
        fontSize: 15,
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(3),
    },
    inputMultiline: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    successIcon: { alignItems: 'center', marginBottom: theme.spacing(4), marginTop: theme.spacing(6) },
    successEmoji: { fontSize: 56 },
    codeBox: {
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing(4),
        alignItems: 'center',
        marginVertical: theme.spacing(5),
    },
    codeLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: theme.spacing(2) },
    codeValue: { color: theme.colors.accent, fontSize: 22, fontWeight: '800', letterSpacing: 2 },
    actionBtn: { marginBottom: theme.spacing(3) },
    publishedBadge: {
        backgroundColor: '#0f2d1a',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        padding: theme.spacing(3),
        alignItems: 'center',
        marginBottom: theme.spacing(3),
    },
    publishedText: { color: theme.colors.accent, fontWeight: '600', fontSize: 14 },
});
