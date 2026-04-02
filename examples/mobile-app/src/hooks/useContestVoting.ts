import React from 'react';
import NetInfo from '@react-native-community/netinfo';
import { socialApi, VotePayload, TrackMeta } from '../services/socialApi';
import { voteQueue } from '../services/voteQueue';
import { retryWithBackoff } from '../services/retryBackoff';

/** Matches session voting: near-center releases are ties (contests require a side — see vote()). */
const TIE_BAND = 0.1;

export function useContestVoting(contestId: string, userId: string | null) {
    const voteInFlight = React.useRef(false);
    const [currentPair, setCurrentPair] = React.useState<[string, string] | null>(null);
    const [pairMeta, setPairMeta] = React.useState<{ a: TrackMeta | null; b: TrackMeta | null } | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [pendingCount, setPendingCount] = React.useState(voteQueue.getPendingCount());

    React.useEffect(() => {
        if (!contestId || !userId) {
            setCurrentPair(null);
            setPairMeta(null);
            setDone(false);
            setLoading(false);
            setError(null);
            return;
        }
        let cancelled = false;
        const init = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await socialApi.getNextPair(contestId, userId);
                if (cancelled) return;
                if (!result.nextPair) setDone(true);
                else {
                    setCurrentPair([result.nextPair.a, result.nextPair.b]);
                    setPairMeta(result.pairMeta ?? null);
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to get pair');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        init();
        return () => { cancelled = true; };
    }, [contestId, userId]);

    // Drain the persisted vote queue when connectivity is restored
    React.useEffect(() => {
        const drainQueue = async () => {
            const pending = voteQueue.getQueue();
            for (const item of pending) {
                try {
                    await retryWithBackoff(() =>
                        socialApi.voteInContest(item.contestId, item.payload)
                    );
                    voteQueue.remove(item.id);
                    setPendingCount(voteQueue.getPendingCount());
                } catch {
                    voteQueue.incrementRetry(item.id);
                }
            }
        };
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected && state.isInternetReachable) {
                drainQueue();
            }
        });
        return () => unsubscribe();
    }, []);

    const vote = async (strength: number) => {
        if (!currentPair || !userId || voteInFlight.current) return;
        if (Math.abs(strength) < TIE_BAND) {
            setError('Slide further left or right to pick a winner.');
            return;
        }
        const choice = strength < 0 ? 0 : 1;
        voteInFlight.current = true;
        setLoading(true);
        setError(null);
        const payload: VotePayload = { userId, pair: currentPair, choice };
        const queueId = voteQueue.enqueue(contestId, payload);
        setPendingCount(voteQueue.getPendingCount());
        try {
            const result = await socialApi.voteInContest(contestId, payload);
            voteQueue.remove(queueId);
            setPendingCount(voteQueue.getPendingCount());
            if (!result.nextPair) setDone(true);
            else {
                setCurrentPair([result.nextPair.a, result.nextPair.b]);
                setPairMeta(result.pairMeta ?? null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to submit vote');
        } finally {
            voteInFlight.current = false;
            setLoading(false);
        }
    };

    return { currentPair, pairMeta, loading, done, error, vote, pendingCount };
}
