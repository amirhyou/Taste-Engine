import { redis } from './client';

type EngineSnapshot = Record<string, unknown>;

const itemsKey = (id: string) => `contest:${id}:items`;
const snapshotKey = (id: string) => `contest:${id}:snapshot`;
const ALL_KEY = 'contest:all';
const TTL = 60 * 60 * 24 * 90; // 90 days

export async function storeContestItems(id: string, items: string[]): Promise<void> {
  await redis.pipeline()
    .set(itemsKey(id), JSON.stringify(items))
    .expire(itemsKey(id), TTL)
    .sadd(ALL_KEY, id)
    .exec();
}

export async function getContestItems(id: string): Promise<string[] | null> {
  const raw = await redis.get(itemsKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return null;
  }
}

export async function storeEngineSnapshot(id: string, snapshot: EngineSnapshot): Promise<void> {
  await redis.pipeline()
    .set(snapshotKey(id), JSON.stringify(snapshot))
    .expire(snapshotKey(id), TTL)
    .exec();
}

export async function getEngineSnapshot(id: string): Promise<EngineSnapshot | null> {
  const raw = await redis.get(snapshotKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EngineSnapshot;
  } catch {
    return null;
  }
}

export async function listAllContestIds(): Promise<string[]> {
  return redis.smembers(ALL_KEY);
}
