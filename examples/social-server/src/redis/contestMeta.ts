import { randomBytes } from 'crypto';
import { redis } from './client';

export type ContestStatus = 'draft' | 'published' | 'hidden' | 'locked';

export type ContestMeta = {
  id: string;
  status: ContestStatus;
  createdAt: number;
  publishedAt?: number;
  inviteCode: string;
  title?: string;
  description?: string;
};

const metaKey = (id: string) => `contest:meta:${id}`;
const inviteKey = (code: string) => `contest:invite:${code}`;
const publishedKey = () => 'contest:published';

function toOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toOptionalString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length > 0 ? value : undefined;
}

export async function createContestMeta(input: {
  id: string;
  title?: string;
  description?: string;
}): Promise<{ inviteCode: string }> {
  const inviteCode = randomBytes(12).toString('base64url');
  const createdAt = Date.now();

  await redis.hset(metaKey(input.id), {
    id: input.id,
    status: 'draft',
    createdAt: String(createdAt),
    publishedAt: '',
    inviteCode,
    title: input.title ?? '',
    description: input.description ?? '',
  });

  await redis.set(inviteKey(inviteCode), input.id);

  return { inviteCode };
}

export async function getContestMeta(id: string): Promise<ContestMeta | null> {
  const data = await redis.hgetall(metaKey(id));
  if (!data || Object.keys(data).length === 0) return null;

  return {
    id: data.id ?? id,
    status: (data.status as ContestStatus) ?? 'draft',
    createdAt: Number(data.createdAt ?? 0),
    publishedAt: toOptionalNumber(data.publishedAt),
    inviteCode: data.inviteCode ?? '',
    title: toOptionalString(data.title),
    description: toOptionalString(data.description),
  };
}

export async function publishContest(id: string): Promise<void> {
  const publishedAt = Date.now();
  await redis.hset(metaKey(id), {
    status: 'published',
    publishedAt: String(publishedAt),
  });
  await redis.zadd(publishedKey(), publishedAt, id);
}

export async function hideContest(id: string): Promise<void> {
  await redis.hset(metaKey(id), { status: 'hidden' });
  await redis.zrem(publishedKey(), id);
}

export async function lockContest(id: string): Promise<void> {
  await redis.hset(metaKey(id), { status: 'locked' });
  await redis.zrem(publishedKey(), id);
}

export async function resolveInvite(code: string): Promise<string | null> {
  const contestId = await redis.get(inviteKey(code));
  return contestId ?? null;
}

export async function listPublishedContests(limit: number, offset: number): Promise<string[]> {
  const safeLimit = Math.max(0, Math.min(limit, 100));
  const safeOffset = Math.max(0, offset);
  return redis.zrevrange(publishedKey(), safeOffset, safeOffset + safeLimit - 1);
}
