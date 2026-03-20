import { redis } from './client';

const SEEN_CAP = 5000;

const seenKey = (contestId: string, userId: string) => `seen:${contestId}:${userId}`;

export async function hasSeen(
  userId: string,
  contestId: string,
  pk: string,
): Promise<boolean> {
  return (await redis.zscore(seenKey(contestId, userId), pk)) !== null;
}

export async function markSeen(
  userId: string,
  contestId: string,
  pk: string,
): Promise<void> {
  const key = seenKey(contestId, userId);
  await redis.zadd(key, Date.now(), pk);
  // Keep newest SEEN_CAP entries; remove oldest beyond the cap
  await redis.zremrangebyrank(key, 0, -(SEEN_CAP + 1));
}
