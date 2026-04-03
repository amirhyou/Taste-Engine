import { getDeviceId } from './deviceId';
import { NextPairResultSchema } from '../schemas';

const BASE_URL = process.env.EXPO_PUBLIC_SOCIAL_SERVER_URL ?? '';

export interface ContestMeta {
    id: string;
    title?: string;
    description?: string;
    status: 'draft' | 'published' | 'locked' | 'hidden';
    itemCount?: number;
    inviteCode?: string;
    createdAt?: number;
}

export interface RankedTrack {
    rank: number;
    id: string;
    name: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
}

export interface ContestResults {
    ranking: RankedTrack[];
    total: number;
}

export interface CreateContestPayload {
    items: string[];
    itemMeta?: Record<string, TrackMeta>;
    title?: string;
    description?: string;
}

export interface CreateContestResult {
    contestId: string;
    inviteCode: string;
}

export interface VotePayload {
    userId: string;
    pair: [string, string];
    choice: number;
}

export interface TrackMeta {
    name: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
    previewUrl?: string;
}

export interface NextPairResult {
    nextPair: { a: string; b: string } | null;
    pairMeta?: { a: TrackMeta | null; b: TrackMeta | null };
}

function mergeHeaders(extra: HeadersInit | undefined): Record<string, string> {
    if (!extra) return {};
    if (extra instanceof Headers) {
        const out: Record<string, string> = {};
        extra.forEach((v, k) => {
            out[k] = v;
        });
        return out;
    }
    if (Array.isArray(extra)) {
        const out: Record<string, string> = {};
        for (const [k, v] of extra) out[k] = v;
        return out;
    }
    return { ...extra };
}

async function fetchSocial(path: string, options: RequestInit = {}): Promise<any> {
    if (!BASE_URL) {
        throw new Error('EXPO_PUBLIC_SOCIAL_SERVER_URL is not configured');
    }
    const deviceId = await getDeviceId();
    const headers: Record<string, string> = {
        'x-device-id': deviceId,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...mergeHeaders(options.headers),
    };
    const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Social API ${response.status}: ${body || response.statusText}`);
    }
    return response.json();
}

export const socialApi = {
    createContest: (payload: CreateContestPayload): Promise<CreateContestResult> =>
        fetchSocial('/contests', { method: 'POST', body: JSON.stringify(payload) }),

    voteInContest: async (contestId: string, payload: VotePayload): Promise<NextPairResult> => {
        const data = await fetchSocial(`/contests/${contestId}/vote`, { method: 'POST', body: JSON.stringify(payload) });
        const validated = NextPairResultSchema.safeParse(data);
        if (!validated.success) throw new Error('Invalid server response for voteInContest');
        return validated.data;
    },

    getNextPair: async (contestId: string, userId: string): Promise<NextPairResult> => {
        const data = await fetchSocial(`/contests/${contestId}/next?userId=${encodeURIComponent(userId)}`);
        const validated = NextPairResultSchema.safeParse(data);
        if (!validated.success) throw new Error('Invalid server response for nextPair');
        return validated.data;
    },

    publishContest: (contestId: string): Promise<{ status: string }> =>
        fetchSocial(`/contests/${contestId}/publish`, { method: 'POST' }),

    getContest: (contestId: string): Promise<ContestMeta> =>
        fetchSocial(`/contests/${contestId}`),

    discoverContests: (limit = 20, offset = 0): Promise<{ items: ContestMeta[] }> =>
        fetchSocial(`/discover?limit=${limit}&offset=${offset}`),

    getContestByInvite: (code: string): Promise<ContestMeta> =>
        fetchSocial(`/invites/${encodeURIComponent(code)}`),

    unpublishContest: (contestId: string): Promise<{ status: string }> =>
        fetchSocial(`/contests/${contestId}/unpublish`, { method: 'POST' }),

    closeContest: (contestId: string): Promise<{ status: string }> =>
        fetchSocial(`/contests/${contestId}/close`, { method: 'POST' }),

    getContestResults: (contestId: string): Promise<ContestResults> =>
        fetchSocial(`/contests/${contestId}/results`),
};
