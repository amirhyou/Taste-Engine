import { randomUUID } from 'crypto';
import type { PairRecommendation } from '@taste-engine/core';
import { ContestCoordinator } from '../coordinator/ContestCoordinator';
import { acquireLock, releaseLock } from '../redis/locks';
import { isOnCooldown, recordVote } from '../redis/cooldown';
import { hasSeen, markSeen } from '../redis/seen';
import { getContestMeta } from '../redis/contestMeta';
import { pairKey } from './pairKey';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface VotePayload {
  pair: [string, string];
  choice: number;
}

const MAX_SEEN_RETRIES = 5;
const LOCK_RETRIES = 3;
const LOCK_RETRY_DELAY_MS = 50;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RedisDispatcher {
  constructor(private readonly coordinator: ContestCoordinator) {}

  private async assertContestStatus(contestId: string): Promise<void> {
    const meta = await getContestMeta(contestId);
    if (!meta) throw new HttpError(404, 'Contest not found');
    if (meta.status === 'hidden') throw new HttpError(404, 'Contest not found');
    if (meta.status === 'locked') {
      throw new HttpError(409, 'Contest locked');
    }
  }

  async getNextPair(
    contestId: string,
    userId: string,
  ): Promise<PairRecommendation | null> {
    await this.assertContestStatus(contestId);
    if (await isOnCooldown(userId)) {
      throw new HttpError(429, 'Too many requests');
    }

    let pair: PairRecommendation | null = null;
    for (let i = 0; i < MAX_SEEN_RETRIES; i++) {
      pair = this.coordinator.getNextPair(contestId);
      if (!pair) break;
      const pk = pairKey(pair.a, pair.b);
      if (!(await hasSeen(userId, contestId, pk))) break;
    }

    if (pair) {
      await markSeen(userId, contestId, pairKey(pair.a, pair.b));
    }

    return pair;
  }

  async submitVote(
    contestId: string,
    userId: string,
    vote: VotePayload,
  ): Promise<PairRecommendation | null> {
    await this.assertContestStatus(contestId);
    if (await isOnCooldown(userId)) {
      throw new HttpError(429, 'Too many requests');
    }

    const pk = pairKey(vote.pair[0], vote.pair[1]);
    const ownerId = randomUUID();

    // Acquire lock with retries
    let locked = false;
    for (let i = 0; i < LOCK_RETRIES; i++) {
      locked = await acquireLock(contestId, pk, ownerId);
      if (locked) break;
      if (i < LOCK_RETRIES - 1) await sleep(LOCK_RETRY_DELAY_MS);
    }
    if (!locked) {
      throw new HttpError(409, 'Pair locked, retry');
    }

    let next: PairRecommendation | null = null;
    try {
      next = this.coordinator.submitVote(contestId, { ...vote, userId });
    } finally {
      await releaseLock(contestId, pk, ownerId);
    }

    await recordVote(userId);

    if (next) {
      await markSeen(userId, contestId, pairKey(next.a, next.b));
    }

    return next;
  }
}
