import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Share, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { socialApi, ContestMeta, RankedTrack, TrackMeta } from '../services/socialApi';
import { myContestsStore } from '../services/myContests';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { useContestVoting } from '../hooks/useContestVoting';
import { useSpotifyUser } from '../hooks/useSpotifyUser';
import { PairStack } from '../components/PairStack';
import { StrengthSlider } from '../components/StrengthSlider';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ItemMetadata } from '../services/engineManager';
import { theme } from '../theme';

interface ContestDetailScreenProps {
    contestId: string;
}

export function ContestDetailScreen({ contestId }: ContestDetailScreenProps) {
    const router = useRouter();
    const { token, promptAsync } = useSpotifyAuth();
    const { userId, loading: userLoading, error: userError, refetch: refetchSpotifyUser } = useSpotifyUser();
    const { currentPair, pairMeta: serverPairMeta, loading: voteLoading, done, error: voteError, vote } = useContestVoting(contestId, userId);

    const [contest, setContest] = React.useState<ContestMeta | null>(null);
    const [contestLoading, setContestLoading] = React.useState(true);
    const [isOwned, setIsOwned] = React.useState(false);
    const [publishing, setPublishing] = React.useState(false);
    const [closing, setClosing] = React.useState(false);
    const [unpublishing, setUnpublishing] = React.useState(false);
    const [results, setResults] = React.useState<RankedTrack[] | null>(null);
    const [resultsLoading, setResultsLoading] = React.useState(false);
    const [contestError, setContestError] = React.useState<string | null>(null);

    // Load contest metadata and check ownership
    React.useEffect(() => {
        setContest(null);
        setContestError(null);
        setContestLoading(true);
        socialApi.getContest(contestId)
            .then(setContest)
            .catch((e) => {
                setContestError(e instanceof Error ? e.message : 'Failed to load contest');
            })
            .finally(() => setContestLoading(false));
        myContestsStore.getAll().then(saved => {
            setIsOwned(saved.some(c => c.id === contestId));
        });
    }, [contestId]);

    const handlePublish = async () => {
        setPublishing(true);
        try {
            await socialApi.publishContest(contestId);
            setContest(prev => prev ? { ...prev, status: 'published' } : prev);
            await myContestsStore.setPublished(contestId, true);
        } catch (e) {
            Alert.alert('Failed to publish', e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setPublishing(false);
        }
    };

    const handleUnpublish = async () => {
        setUnpublishing(true);
        try {
            await socialApi.unpublishContest(contestId);
            setContest(prev => prev ? { ...prev, status: 'draft' } : prev);
            await myContestsStore.setPublished(contestId, false);
        } catch (e) {
            Alert.alert('Failed to unpublish', e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setUnpublishing(false);
        }
    };

    const handleClose = () => {
        Alert.alert(
            'Close Contest',
            'This stops all voting permanently. You can still view results. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Close Contest', style: 'destructive', onPress: async () => {
                        setClosing(true);
                        try {
                            await socialApi.closeContest(contestId);
                            setContest(prev => prev ? { ...prev, status: 'locked' } : prev);
                            await myContestsStore.setClosed(contestId);
                            loadResults();
                        } catch (e) {
                            Alert.alert('Failed to close', e instanceof Error ? e.message : 'Unknown error');
                        } finally {
                            setClosing(false);
                        }
                    }
                },
            ]
        );
    };

    const loadResults = React.useCallback(async () => {
        setResultsLoading(true);
        try {
            const data = await socialApi.getContestResults(contestId);
            setResults(data.ranking);
        } catch {
            setResults([]);
        } finally {
            setResultsLoading(false);
        }
    }, [contestId]);

    // Auto-load results for closed contests
    React.useEffect(() => {
        if (contest?.status === 'locked') void loadResults();
    }, [contest?.status, loadResults]);

    // Derive ItemMetadata from server-provided pairMeta
    const pairItems: { a: ItemMetadata | null; b: ItemMetadata | null } = React.useMemo(() => {
        if (!currentPair) return { a: null, b: null };
        const toMeta = (meta: TrackMeta | null, id: string): ItemMetadata =>
            meta ? { id, name: meta.name, artist: meta.artist, album: meta.album, imageUrl: meta.imageUrl, previewUrl: meta.previewUrl } : { id, name: 'Unknown Track' };
        return {
            a: toMeta(serverPairMeta?.a ?? null, currentPair[0]),
            b: toMeta(serverPairMeta?.b ?? null, currentPair[1]),
        };
    }, [currentPair, serverPairMeta]);

    const handleShare = async () => {
        if (!contest?.inviteCode) return;
        await Share.share({
            message: `Join my Tastify contest!\nInvite code: ${contest.inviteCode}\n\nOpen Tastify → Contests → Join with Code`,
            title: contest.title || 'Tastify Contest',
        });
    };

    // Not logged in
    if (!token) {
        return (
            <Screen>
                <View style={styles.navBar}>
                    <Button label="← Back" onPress={() => router.replace('/(tabs)/contests' as any)} kind="secondary" style={styles.backBtn} />
                </View>
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>Connect Spotify to vote</Text>
                    <View style={styles.gap} />
                    <Button label="Connect Spotify" onPress={() => promptAsync()} />
                </View>
            </Screen>
        );
    }

    if (contestLoading) {
        return (
            <Screen>
                <View style={styles.navBar}>
                    <Button label="← Back" onPress={() => router.replace('/(tabs)/contests' as any)} kind="secondary" style={styles.backBtn} />
                </View>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                </View>
            </Screen>
        );
    }

    if (contestError && !contest) {
        return (
            <Screen>
                <View style={styles.navBar}>
                    <Button label="← Back" onPress={() => router.replace('/(tabs)/contests' as any)} kind="secondary" style={styles.backBtn} />
                </View>
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>{contestError}</Text>
                    <View style={styles.gap} />
                    <Button label="Back to Contests" onPress={() => router.replace('/(tabs)/contests' as any)} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <View style={styles.navBar}>
                <Button label="← Back" onPress={() => router.replace('/(tabs)/contests' as any)} kind="secondary" style={styles.backBtn} />
                {contest?.inviteCode && (
                    <Button label="Share" onPress={handleShare} kind="secondary" style={styles.shareBtn} />
                )}
            </View>

            <View style={styles.contestInfo}>
                <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={2}>
                        {contest?.title || 'Contest'}
                    </Text>
                    {contest?.status === 'published' && <Badge label="public" tone="success" />}
                    {contest?.status === 'locked' && <Badge label="closed" tone="default" />}
                    {contest?.status === 'draft' && isOwned && <Badge label="private" tone="default" />}
                </View>
                {contest?.description ? (
                    <Text style={styles.description}>{contest.description}</Text>
                ) : null}
                {isOwned && contest && contest.status !== 'locked' && (
                    <View style={styles.ownerActions}>
                        {contest.status === 'draft' && (
                            <Button label={publishing ? 'Publishing...' : 'Make Public'} onPress={handlePublish} kind="secondary" style={styles.ownerBtn} />
                        )}
                        {contest.status === 'published' && (
                            <Button label={unpublishing ? 'Unpublishing...' : 'Unpublish'} onPress={handleUnpublish} kind="secondary" style={styles.ownerBtn} />
                        )}
                        <Button label={closing ? 'Closing...' : 'Close Contest'} onPress={handleClose} kind="secondary" style={styles.ownerBtn} />
                    </View>
                )}
                {isOwned && contest && contest.status === 'locked' && (
                    <Button label={resultsLoading ? 'Loading...' : 'Refresh Results'} onPress={loadResults} kind="secondary" style={styles.publishBtn} />
                )}
                {userLoading && (
                    <Text style={styles.loadingSmall}>Loading your account...</Text>
                )}
            </View>

            {voteError && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{voteError}</Text>
                </View>
            )}

            {contest?.status === 'locked' ? (
                <ScrollView style={styles.resultsList} contentContainerStyle={styles.resultsContent}>
                    <Text style={styles.resultHeading}>Final Rankings</Text>
                    {resultsLoading ? (
                        <ActivityIndicator color={theme.colors.accent} style={styles.spinner} />
                    ) : results && results.length > 0 ? results.map(track => (
                        <View key={track.id} style={styles.resultRow}>
                            <Text style={styles.resultRank}>#{track.rank}</Text>
                            <View style={styles.resultInfo}>
                                <Text style={styles.resultName} numberOfLines={1}>{track.name}</Text>
                                {track.artist && <Text style={styles.resultArtist} numberOfLines={1}>{track.artist}</Text>}
                            </View>
                        </View>
                    )) : (
                        <Text style={styles.emptyText}>No results yet — not enough votes recorded.</Text>
                    )}
                </ScrollView>
            ) : done ? (
                <View style={styles.centered}>
                    <Text style={styles.doneEmoji}>🎉</Text>
                    <Text style={styles.doneTitle}>You've voted on all pairs!</Text>
                    <Text style={styles.doneSubtitle}>Your votes have been submitted.</Text>
                    <View style={styles.gap} />
                    <Button label="Back to Contests" onPress={() => router.replace('/(tabs)/contests' as any)} />
                </View>
            ) : userLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loadingText}>Loading account...</Text>
                </View>
            ) : userError && !userId ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>{userError}</Text>
                    <View style={styles.gap} />
                    <Button label="Retry" onPress={refetchSpotifyUser} />
                </View>
            ) : !userId ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>Spotify user ID unavailable.</Text>
                </View>
            ) : voteLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.accent} />
                    <Text style={styles.loadingText}>Loading next pair...</Text>
                </View>
            ) : currentPair && pairItems.a && pairItems.b ? (
                <>
                    <Text style={styles.instruction}>Slide to pick your favourite</Text>
                    <PairStack itemA={pairItems.a} itemB={pairItems.b} />
                    <StrengthSlider onVote={vote} disabled={voteLoading} />
                </>
            ) : (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No pairs to vote on</Text>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing(4),
        paddingTop: theme.spacing(6),
        paddingBottom: theme.spacing(2),
    },
    backBtn: {
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(2),
    },
    shareBtn: {
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(2),
    },
    contestInfo: {
        paddingHorizontal: theme.spacing(5),
        paddingBottom: theme.spacing(3),
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(3),
        marginBottom: theme.spacing(1),
    },
    title: {
        ...theme.typography.title,
        flex: 1,
    },
    description: {
        color: theme.colors.textSecondary,
        fontSize: 14,
        marginTop: theme.spacing(1),
    },
    publishBtn: {
        marginTop: theme.spacing(3),
        alignSelf: 'flex-start',
    },
    ownerActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: theme.spacing(2),
        marginTop: theme.spacing(3),
    },
    ownerBtn: {
        paddingHorizontal: theme.spacing(3),
        paddingVertical: theme.spacing(2),
    },
    resultsList: { flex: 1 },
    resultsContent: { padding: theme.spacing(5) },
    resultHeading: {
        ...theme.typography.subtitle,
        marginBottom: theme.spacing(4),
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: theme.spacing(3),
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        gap: theme.spacing(3),
    },
    resultRank: {
        color: theme.colors.accent,
        fontWeight: '800',
        fontSize: 16,
        width: 36,
    },
    resultInfo: { flex: 1 },
    resultName: {
        color: theme.colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    resultArtist: {
        color: theme.colors.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    spinner: { marginTop: theme.spacing(6) },
    loadingSmall: {
        color: theme.colors.textMuted,
        fontSize: 12,
        marginTop: theme.spacing(1),
    },
    instruction: {
        color: theme.colors.textSecondary,
        fontSize: 13,
        textAlign: 'center',
        marginTop: theme.spacing(3),
        marginBottom: -theme.spacing(2),
    },
    errorBox: {
        margin: theme.spacing(5),
        backgroundColor: '#2a1b1b',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.danger,
        padding: theme.spacing(3),
    },
    errorText: { color: theme.colors.danger, fontSize: 14 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing(5) },
    gap: { height: theme.spacing(4) },
    doneEmoji: { fontSize: 48, marginBottom: theme.spacing(4) },
    doneTitle: { ...theme.typography.subtitle, marginBottom: theme.spacing(2) },
    doneSubtitle: { color: theme.colors.textSecondary, fontSize: 14 },
    loadingText: { color: theme.colors.textSecondary, marginTop: theme.spacing(3) },
    emptyText: { color: theme.colors.textSecondary, fontSize: 15 },
});
