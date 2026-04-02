import { redis } from './client';

export interface TrackMeta {
  name: string;
  artist?: string;
  album?: string;
  imageUrl?: string;
  previewUrl?: string;
}

const key = (contestId: string) => `track-meta:${contestId}`;
const TTL = 60 * 60 * 24 * 90; // 90 days

export async function storeTrackMeta(
  contestId: string,
  meta: Record<string, TrackMeta>,
): Promise<void> {
  if (Object.keys(meta).length === 0) return;
  const pipeline = redis.pipeline();
  for (const [trackId, trackMeta] of Object.entries(meta)) {
    pipeline.hset(key(contestId), trackId, JSON.stringify(trackMeta));
  }
  pipeline.expire(key(contestId), TTL);
  await pipeline.exec();
}

export async function getTrackMeta(
  contestId: string,
  trackId: string,
): Promise<TrackMeta | null> {
  const raw = await redis.hget(key(contestId), trackId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrackMeta;
  } catch {
    return null;
  }
}
