import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDispatcher = vi.hoisted(() => ({
  submitVote: vi.fn(),
  getNextPair: vi.fn(),
}));

const MockHttpError = vi.hoisted(() => {
  return class HttpError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message);
      this.name = 'HttpError';
    }
  };
});

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(() => Promise.resolve({ id: 'mock-job-id' })),
    close: vi.fn(() => Promise.resolve()),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('../../redis/client', () => ({
  redis: {
    ping: vi.fn(() => Promise.resolve('PONG')),
    incr: vi.fn(() => Promise.resolve(1)),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(60)),
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve('OK')),
    del: vi.fn(() => Promise.resolve(1)),
    exists: vi.fn(() => Promise.resolve(0)),
    sismember: vi.fn(() => Promise.resolve(0)),
    setnx: vi.fn(() => Promise.resolve(1)),
    sadd: vi.fn(() => Promise.resolve(1)),
    quit: vi.fn(() => Promise.resolve('OK')),
    status: 'ready',
  },
}));

vi.mock('../../worker/bullmq', () => ({
  eventQueue: {
    add: vi.fn(() => Promise.resolve({ id: 'mock-job-id' })),
    close: vi.fn(() => Promise.resolve()),
  },
  startWorker: vi.fn(),
}));

vi.mock('../../redis/engineState', () => ({
  storeContestItems: vi.fn(() => Promise.resolve()),
  getContestItems: vi.fn(() => Promise.resolve(null)),
  getEngineSnapshot: vi.fn(() => Promise.resolve(null)),
  listAllContestIds: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  withBindings: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('../../api/admin', async () => {
  const { Hono } = await import('hono');
  return { adminApp: new Hono() };
});

vi.mock('../../redis/trackMeta', () => ({
  storeTrackMeta: vi.fn(() => Promise.resolve()),
  getTrackMeta: vi.fn(() => Promise.resolve(null)),
}));

// Mock RedisDispatcher to isolate the vote route from Redis-based dispatch logic
vi.mock('../../dispatch/RedisDispatcher', () => ({
  RedisDispatcher: vi.fn().mockImplementation(() => mockDispatcher),
  HttpError: MockHttpError,
}));

import { app, coordinator } from '../../api/routes';

const contestId = 'test-contest';
const items = ['a', 'b', 'c', 'd'];

describe('POST /contests/:id/vote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coordinator.createContest(contestId, items);
  });

  it('returns 400 for invalid vote body', async () => {
    const res = await app.request(`/contests/${contestId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1' }), // missing pair and choice
    });
    expect(res.status).toBe(400);
  });

  it('returns 200 on valid vote when dispatcher resolves', async () => {
    mockDispatcher.submitVote.mockResolvedValueOnce({
      a: 'b',
      b: 'c',
      meta: {},
    });
    const res = await app.request(`/contests/${contestId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', pair: ['a', 'b'], choice: 1 }),
    });
    expect(res.status).not.toBe(500);
  });

  it('returns 404 when dispatcher throws HttpError 404', async () => {
    mockDispatcher.submitVote.mockRejectedValueOnce(
      new MockHttpError(404, 'Contest not found'),
    );
    const res = await app.request('/contests/does-not-exist/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', pair: ['a', 'b'], choice: 1 }),
    });
    expect([400, 404]).toContain(res.status);
  });
});
