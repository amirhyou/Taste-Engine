import { redis } from './client';

const lockKey = (contestId: string, pk: string) => `lock:${contestId}:pair:${pk}`;

const releaseLua = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export async function acquireLock(
  contestId: string,
  pk: string,
  ownerId: string,
): Promise<boolean> {
  const result = await redis.set(lockKey(contestId, pk), ownerId, 'NX', 'PX', 60000);
  return result === 'OK';
}

export async function releaseLock(
  contestId: string,
  pk: string,
  ownerId: string,
): Promise<void> {
  await redis.eval(releaseLua, 1, lockKey(contestId, pk), ownerId);
}
