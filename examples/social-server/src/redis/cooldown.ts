import { redis } from './client';

const cooldownKey = (userId: string) => `cooldown:${userId}`;
const rateKey = (userId: string) => `rate:${userId}:votes`;

const VOTE_WINDOW_SEC = 10;
const VOTE_THRESHOLD = 30;
const COOLDOWN_SEC = 300; // 5 minutes

export async function isOnCooldown(userId: string): Promise<boolean> {
  return (await redis.exists(cooldownKey(userId))) === 1;
}

export async function triggerCooldown(userId: string): Promise<void> {
  await redis.set(cooldownKey(userId), '1', 'EX', COOLDOWN_SEC);
}

export async function recordVote(userId: string): Promise<void> {
  const key = rateKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, VOTE_WINDOW_SEC);
  }
  if (count > VOTE_THRESHOLD) {
    await triggerCooldown(userId);
  }
}
