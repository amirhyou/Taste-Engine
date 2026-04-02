import React from 'react';
import { socialApi, VotePayload, TrackMeta } from '../services/socialApi';

/** Matches session voting: near-center releases are ties (contests require a side — see vote()). */
const TIE_BAND = 0.1;

export function useContestVoting(contestId: string, userId: string | null) {
    const voteInFlight = React.useRef(false);
    const [currentPair, setCurrentPair] = React.useState<[string, string] | null>(null);
    const [pairMeta, setPairMeta] = React.useState<{ a: TrackMeta | null; b: TrackMeta | null } | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [done, setDone] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

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
        try {
            const payload: VotePayload = { userId, pair: currentPair, choice };
            const result = await socialApi.voteInContest(contestId, payload);
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

    return { currentPair, pairMeta, loading, done, error, vote };
}
