import React from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, ActivityIndicator,
    TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { socialApi, ContestMeta } from '../services/socialApi';
import { myContestsStore, SavedContest } from '../services/myContests';
import { useSpotifyAuth } from '../services/spotifyAuth';
import { Screen } from '../components/ui/Screen';
import { Button } from '../components/ui/Button';
import { ListItem } from '../components/ui/ListItem';
import { Badge } from '../components/ui/Badge';
import { theme } from '../theme';

export function ContestHubScreen() {
    const router = useRouter();
    const { token, promptAsync } = useSpotifyAuth();
    const [contests, setContests] = React.useState<ContestMeta[]>([]);
    const [discoverLoading, setDiscoverLoading] = React.useState(true);
    const [discoverError, setDiscoverError] = React.useState<string | null>(null);
    const [joinCode, setJoinCode] = React.useState('');
    const [joining, setJoining] = React.useState(false);
    const [myContests, setMyContests] = React.useState<SavedContest[]>([]);

    const loadDiscover = React.useCallback(async () => {
        setDiscoverLoading(true);
        setDiscoverError(null);
        try {
            const result = await socialApi.discoverContests(20, 0);
            setContests(result.items);
        } catch (e) {
            setDiscoverError(e instanceof Error ? e.message : 'Failed to load contests');
        } finally {
            setDiscoverLoading(false);
        }
    }, []);

    const loadMyContests = React.useCallback(async () => {
        const saved = await myContestsStore.getAll();
        setMyContests(saved);
    }, []);

    useFocusEffect(React.useCallback(() => {
        loadDiscover();
        loadMyContests();
    }, [loadDiscover, loadMyContests]));

    const handleJoin = async () => {
        const code = joinCode.trim();
        if (!code) return;
        setJoining(true);
        try {
            const meta = await socialApi.getContestByInvite(code);
            setJoinCode('');
            router.push({ pathname: '/(tabs)/contests/[id]', params: { id: meta.id } } as any);
        } catch (e) {
            Alert.alert('Invalid code', 'No contest found with that invite code.');
        } finally {
            setJoining(false);
        }
    };

    const handleContestPress = (contest: ContestMeta) => {
        router.push({ pathname: '/(tabs)/contests/[id]', params: { id: contest.id } } as any);
    };

    return (
        <Screen>
            <View style={styles.header}>
                <Text style={styles.title}>Contests</Text>
            </View>

            {!token ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>Connect Spotify to create contests</Text>
                    <View style={styles.gap} />
                    <Button label="Connect Spotify" onPress={() => promptAsync()} />
                </View>
            ) : (
                <Button
                    label="+ New Contest"
                    onPress={() => router.push('/(tabs)/contests/create' as any)}
                    style={styles.createBtn}
                />
            )}

            <View style={styles.joinRow}>
                <TextInput
                    style={styles.joinInput}
                    placeholder="Enter invite code"
                    placeholderTextColor={theme.colors.textMuted}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity
                    style={[styles.joinBtn, (!joinCode.trim() || joining) && styles.joinBtnDisabled]}
                    onPress={handleJoin}
                    disabled={!joinCode.trim() || joining}
                >
                    {joining
                        ? <ActivityIndicator size="small" color={theme.colors.accentText} />
                        : <Text style={styles.joinBtnText}>Join</Text>
                    }
                </TouchableOpacity>
            </View>

            {myContests.filter(c => !c.closed).length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>My Contests</Text>
                    </View>
                    {myContests.filter(c => !c.closed).map(contest => (
                        <ListItem
                            key={contest.id}
                            title={contest.title}
                            subtitle={`Code: ${contest.inviteCode}`}
                            placeholderIcon="🏆"
                            onPress={() => router.push({ pathname: '/(tabs)/contests/[id]', params: { id: contest.id } } as any)}
                            trailing={<Badge label={contest.published ? 'public' : 'private'} tone={contest.published ? 'success' : 'default'} />}
                        />
                    ))}
                    <View style={styles.sectionGap} />
                </>
            )}

            {myContests.filter(c => c.closed).length > 0 && (
                <>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Completed</Text>
                    </View>
                    {myContests.filter(c => c.closed).map(contest => (
                        <ListItem
                            key={contest.id}
                            title={contest.title}
                            subtitle="Voting closed — tap to see results"
                            placeholderIcon="🏅"
                            onPress={() => router.push({ pathname: '/(tabs)/contests/[id]', params: { id: contest.id } } as any)}
                            trailing={<Badge label="closed" tone="default" />}
                        />
                    ))}
                    <View style={styles.sectionGap} />
                </>
            )}

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Discover</Text>
                <TouchableOpacity onPress={loadDiscover}>
                    <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
            </View>

            {discoverLoading ? (
                <ActivityIndicator size="large" color={theme.colors.accent} style={styles.spinner} />
            ) : discoverError ? (
                <View style={styles.centered}>
                    <Text style={styles.errorText}>{discoverError}</Text>
                    <View style={styles.gap} />
                    <Button label="Retry" onPress={loadDiscover} kind="secondary" />
                </View>
            ) : contests.length === 0 ? (
                <View style={styles.centered}>
                    <Text style={styles.emptyText}>No public contests yet.</Text>
                    <Text style={styles.emptySubText}>Create one and publish it!</Text>
                </View>
            ) : (
                <FlatList
                    data={contests}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ListItem
                            title={item.title || 'Untitled Contest'}
                            subtitle={item.description || `${item.itemCount ?? '?'} tracks`}
                            placeholderIcon="🏆"
                            onPress={() => handleContestPress(item)}
                            trailing={<Badge label="public" tone="success" />}
                        />
                    )}
                    onRefresh={loadDiscover}
                    refreshing={discoverLoading}
                />
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingTop: theme.spacing(8),
        paddingHorizontal: theme.spacing(5),
        paddingBottom: theme.spacing(4),
    },
    title: {
        ...theme.typography.title,
    },
    createBtn: {
        marginHorizontal: theme.spacing(5),
        marginBottom: theme.spacing(4),
    },
    joinRow: {
        flexDirection: 'row',
        marginHorizontal: theme.spacing(5),
        marginBottom: theme.spacing(5),
        gap: theme.spacing(2),
    },
    joinInput: {
        flex: 1,
        height: 44,
        backgroundColor: theme.colors.surfaceSubtle,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing(3),
        color: theme.colors.textPrimary,
        fontSize: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    joinBtn: {
        height: 44,
        paddingHorizontal: theme.spacing(4),
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 64,
    },
    joinBtnDisabled: {
        opacity: 0.5,
    },
    joinBtnText: {
        color: theme.colors.accentText,
        fontWeight: '700',
        fontSize: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing(5),
        marginBottom: theme.spacing(2),
    },
    sectionTitle: {
        ...theme.typography.subtitle,
    },
    refreshText: {
        color: theme.colors.accent,
        fontSize: 13,
        fontWeight: '600',
    },
    sectionGap: { height: theme.spacing(2) },
    spinner: { marginTop: theme.spacing(10) },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing(5) },
    gap: { height: theme.spacing(3) },
    emptyText: { color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center' },
    emptySubText: { color: theme.colors.textMuted, fontSize: 13, marginTop: theme.spacing(1) },
    errorText: { color: theme.colors.danger, fontSize: 14, textAlign: 'center' },
});
