import { describe, it, expect, vi } from 'vitest';

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

import { ContestCoordinator } from '../../coordinator/ContestCoordinator';

describe('ContestCoordinator', () => {
  it('creates a contest and lists it as active', () => {
    const cc = new ContestCoordinator();
    cc.createContest('c1', ['x', 'y', 'z']);
    expect(cc.listActive()).toContain('c1');
  });

  it('getNextPair returns a pair with a and b after contest creation', () => {
    const cc = new ContestCoordinator();
    cc.createContest('c2', ['a', 'b', 'c', 'd']);
    const pair = cc.getNextPair('c2');
    expect(pair).toBeTruthy();
    expect(pair).toHaveProperty('a');
    expect(pair).toHaveProperty('b');
  });

  it('getNextPair throws for unknown contest id', () => {
    const cc = new ContestCoordinator();
    expect(() => cc.getNextPair('does-not-exist')).toThrow('Contest not found');
  });

  it('submitVote ingests a vote and returns next pair', () => {
    const cc = new ContestCoordinator();
    cc.createContest('c3', ['p', 'q', 'r', 's']);
    const pair = cc.getNextPair('c3') as { a: string; b: string };
    const next = cc.submitVote('c3', { a: pair.a, b: pair.b, result: 'a', t: Date.now() });
    // next is the following PairRecommendation; just assert it has the expected shape
    expect(next).toHaveProperty('a');
    expect(next).toHaveProperty('b');
  });
});
