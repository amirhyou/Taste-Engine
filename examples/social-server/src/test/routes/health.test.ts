import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { redis } from '../../redis/client';
import { app } from '../../api/routes';

describe('GET /health', () => {
  beforeEach(() => {
    vi.mocked(redis.ping).mockResolvedValue('PONG');
  });

  it('returns 200 with status ok when Redis is reachable', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; redis: { status: string } };
    expect(body.status).toBe('ok');
    expect(body.redis.status).toBe('up');
  });

  it('returns 503 when Redis ping fails', async () => {
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await app.request('/health');
    expect(res.status).toBe(503);
    const body = await res.json() as { status: string; redis: { status: string } };
    expect(body.redis.status).toBe('down');
  });
});
