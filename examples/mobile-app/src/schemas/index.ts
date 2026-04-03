import { z } from 'zod';

// ─── SessionMeta ──────────────────────────────────────────────────────────────
export const SessionMetaSchema = z.object({
  playlistId: z.string(),
  playlistName: z.string(),
  targetK: z.number(),
  lastActive: z.number(),
  status: z.enum(['active', 'archived']),
  engineVersion: z.string(),
});
export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export const SessionIndexSchema = z.record(SessionMetaSchema);

// ─── PendingVote (voteQueue) ──────────────────────────────────────────────────
const VotePayloadSchema = z.object({
  userId: z.string(),
  pair: z.tuple([z.string(), z.string()]),
  choice: z.number(),
});

export const PendingVoteSchema = z.object({
  id: z.string(),
  contestId: z.string(),
  payload: VotePayloadSchema,
  enqueuedAt: z.number(),
  retryCount: z.number(),
});

export const VoteQueueSchema = z.array(PendingVoteSchema);

// ─── SavedContest (myContests) ────────────────────────────────────────────────
export const SavedContestSchema = z.object({
  id: z.string(),
  title: z.string(),
  inviteCode: z.string(),
  published: z.boolean(),
  closed: z.boolean(),
  createdAt: z.number(),
});

export const SavedContestListSchema = z.array(SavedContestSchema);

// ─── NextPairResult (API response) ───────────────────────────────────────────
const TrackMetaSchema = z.object({
  name: z.string(),
  artist: z.string().optional(),
  album: z.string().optional(),
  imageUrl: z.string().optional(),
  previewUrl: z.string().optional(),
});

export const NextPairResultSchema = z.object({
  nextPair: z.union([z.object({ a: z.string(), b: z.string() }), z.null()]),
  pairMeta: z
    .object({
      a: z.union([TrackMetaSchema, z.null()]),
      b: z.union([TrackMetaSchema, z.null()]),
    })
    .optional(),
});
