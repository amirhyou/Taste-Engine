---
phase: 12
plan: 2
wave: 1
---

# Plan 12.2: Server Vitest Infrastructure + Vote Flow Tests

## Objective
Bootstrap Vitest in `examples/social-server` (zero test infrastructure today) and write tests for the two highest-value paths: the `/health` and `POST /contests/:id/vote` routes, plus `ContestCoordinator.createContest`. Uses in-memory mocks for Redis and BullMQ — no live service required.

## Context
- .gsd/phases/12/RESEARCH.md
- examples/social-server/package.json
- examples/social-server/src/api/routes.ts
- examples/social-server/src/coordinator/ContestCoordinator.ts
- examples/social-server/src/dispatch/RedisDispatcher.ts
- examples/social-server/src/redis/client.ts

## Tasks

<task type="auto">
  <name>Add Vitest config, scripts, and shared ioredis + BullMQ mocks</name>
  <files>
    examples/social-server/package.json
    examples/social-server/vitest.config.ts (create)
    examples/social-server/src/test/mocks/redis.ts (create)
    examples/social-server/src/test/mocks/bullmq.ts (create)
  </files>
  <action>
    1. Edit `examples/social-server/package.json`:
       - Add to `devDependencies`:
         - `"vitest": "^2.1.8"`
         - `"@vitest/coverage-v8": "^2.1.8"`
       - Add to `scripts`:
         - `"test": "vitest run"`
         - `"test:coverage": "vitest run --coverage"`

    2. Create `examples/social-server/vitest.config.ts`:
    ```ts
    import { defineConfig } from 'vitest/config';

    export default defineConfig({
      test: {
        environment: 'node',
        globals: true,
      },
    });
    ```

    3. Create `examples/social-server/src/test/mocks/redis.ts`:
    ```ts
    import { vi } from 'vitest';

    export function createRedisMock() {
      const store = new Map<string, string>();
      const sets = new Map<string, Set<string>>();
      const sortedSets = new Map<string, Map<string, number>>();

      return {
        get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
        set: vi.fn((k: string, v: string, ..._rest: unknown[]) => {
          store.set(k, v);
          return Promise.resolve('OK' as const);
        }),
        setex: vi.fn((k: string, _ttl: number, v: string) => {
          store.set(k, v);
          return Promise.resolve('OK' as const);
        }),
        del: vi.fn((...keys: string[]) => {
          keys.forEach(k => store.delete(k));
          return Promise.resolve(keys.length);
        }),
        exists: vi.fn((...keys: string[]) =>
          Promise.resolve(keys.filter(k => store.has(k)).length)
        ),
        ping: vi.fn(() => Promise.resolve('PONG' as const)),
        status: 'ready' as const,
        sadd: vi.fn((k: string, ...members: string[]) => {
          if (!sets.has(k)) sets.set(k, new Set());
          members.forEach(m => sets.get(k)!.add(m));
          return Promise.resolve(members.length);
        }),
        sismember: vi.fn((k: string, member: string) =>
          Promise.resolve(sets.get(k)?.has(member) ? 1 : 0)
        ),
        zadd: vi.fn((k: string, score: number, member: string) => {
          if (!sortedSets.has(k)) sortedSets.set(k, new Map());
          sortedSets.get(k)!.set(member, score);
          return Promise.resolve(1);
        }),
        zrangebyscore: vi.fn((_k: string, _min: unknown, _max: unknown) =>
          Promise.resolve([] as string[])
        ),
        setnx: vi.fn((k: string, v: string) => {
          if (store.has(k)) return Promise.resolve(0);
          store.set(k, v);
          return Promise.resolve(1);
        }),
        expire: vi.fn(() => Promise.resolve(1)),
        incr: vi.fn((k: string) => {
          const n = parseInt(store.get(k) ?? '0', 10) + 1;
          store.set(k, String(n));
          return Promise.resolve(n);
        }),
        quit: vi.fn(() => Promise.resolve('OK' as const)),
        // Allow tests to inspect/reset the store
        _store: store,
        _sets: sets,
      };
    }
    ```

    4. Create `examples/social-server/src/test/mocks/bullmq.ts`:
    ```ts
    import { vi } from 'vitest';

    export const mockQueue = {
      add: vi.fn(() => Promise.resolve({ id: 'mock-job-id' })),
      close: vi.fn(() => Promise.resolve()),
    };

    export const mockWorker = {
      on: vi.fn(),
      close: vi.fn(() => Promise.resolve()),
    };
    ```
  </action>
  <verify>
    `cd examples/social-server && npm install && npx vitest run` — exits 0 (no test files yet, but runner initialises).
  </verify>
  <done>
    - vitest.config.ts exists at examples/social-server/
    - devDependencies include vitest and @vitest/coverage-v8
    - "test" script present in package.json
    - src/test/mocks/redis.ts and bullmq.ts created
  </done>
</task>

<task type="auto">
  <name>Write route tests: /health, POST /contests/:id/vote, ContestCoordinator.createContest</name>
  <files>
    examples/social-server/src/test/routes/health.test.ts (create)
    examples/social-server/src/test/routes/vote.test.ts (create)
    examples/social-server/src/test/coordinator/ContestCoordinator.test.ts (create)
  </files>
  <action>
    Before writing tests, audit `examples/social-server/src/api/routes.ts` to confirm:
    - `/health` route path and response shape
    - `POST /contests/:id/vote` expected body fields (VoteSchema: userId, pair, choice)
    - What `ContestCoordinator` exposes: `createContest(id, items)`, `getOrCreate(id, items)`

    Then read `examples/social-server/src/coordinator/ContestCoordinator.ts` and `examples/social-server/src/redis/client.ts` to understand the redis import pattern before mocking.

    Create `examples/social-server/src/test/routes/health.test.ts`:
    ```ts
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { createRedisMock } from '../mocks/redis';

    // Mock redis client before importing routes
    const redisMock = createRedisMock();
    vi.mock('../../redis/client', () => ({ redis: redisMock }));
    vi.mock('bullmq', () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), close: vi.fn() })),
      Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
    }));

    const { app } = await import('../../api/routes');

    describe('GET /health', () => {
      beforeEach(() => {
        redisMock.ping.mockResolvedValue('PONG');
      });

      it('returns 200 with status ok when Redis is reachable', async () => {
        const res = await app.request('/health');
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.redis).toBe('ok');
      });

      it('returns 503 when Redis ping fails', async () => {
        redisMock.ping.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        const res = await app.request('/health');
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.redis).toBe('error');
      });
    });
    ```

    Create `examples/social-server/src/test/routes/vote.test.ts`:
    ```ts
    import { describe, it, expect, vi, beforeEach } from 'vitest';
    import { createRedisMock } from '../mocks/redis';

    const redisMock = createRedisMock();
    vi.mock('../../redis/client', () => ({ redis: redisMock }));
    vi.mock('bullmq', () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(() => Promise.resolve({ id: 'job-1' })), close: vi.fn() })),
      Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
    }));

    const { app, coordinator } = await import('../../api/routes');

    describe('POST /contests/:id/vote', () => {
      const contestId = 'test-contest';
      const items = ['a', 'b', 'c', 'd'];

      beforeEach(async () => {
        vi.clearAllMocks();
        // Ensure a contest exists in the coordinator
        await coordinator.createContest(contestId, items);
      });

      it('returns 400 for invalid vote body', async () => {
        const res = await app.request(`/contests/${contestId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'u1' }), // missing pair and choice
        });
        expect(res.status).toBe(400);
      });

      it('returns 200 with nextPair on valid vote', async () => {
        const res = await app.request(`/contests/${contestId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'u1', pair: ['a', 'b'], choice: 1 }),
        });
        // 200 or 404 (if contest meta not in Redis) — assert no 500
        expect(res.status).not.toBe(500);
      });

      it('returns 404 for unknown contest', async () => {
        const res = await app.request('/contests/does-not-exist/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'u1', pair: ['a', 'b'], choice: 1 }),
        });
        expect([404, 400]).toContain(res.status);
      });
    });
    ```

    Create `examples/social-server/src/test/coordinator/ContestCoordinator.test.ts`:
    ```ts
    import { describe, it, expect, vi } from 'vitest';
    import { createRedisMock } from '../mocks/redis';

    const redisMock = createRedisMock();
    vi.mock('../../redis/client', () => ({ redis: redisMock }));
    vi.mock('bullmq', () => ({
      Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), close: vi.fn() })),
      Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
    }));

    const { ContestCoordinator } = await import('../../coordinator/ContestCoordinator');

    describe('ContestCoordinator', () => {
      it('creates a contest and lists it as active', () => {
        const cc = new ContestCoordinator();
        cc.createContest('c1', ['x', 'y', 'z']);
        expect(cc.listActive()).toContain('c1');
      });

      it('getNextPair returns a pair of items after contest creation', () => {
        const cc = new ContestCoordinator();
        cc.createContest('c2', ['a', 'b', 'c', 'd']);
        const pair = cc.getNextPair('c2');
        expect(Array.isArray(pair)).toBe(true);
        expect(pair).toHaveLength(2);
      });

      it('getNextPair throws for unknown contest id', () => {
        const cc = new ContestCoordinator();
        expect(() => cc.getNextPair('does-not-exist')).toThrow('Contest not found');
      });

      it('submitVote ingests a vote and returns next pair', () => {
        const cc = new ContestCoordinator();
        cc.createContest('c3', ['p', 'q', 'r', 's']);
        const [a, b] = cc.getNextPair('c3') as [string, string];
        const next = cc.submitVote('c3', { a, b, result: 'a', t: Date.now() });
        // next may be a pair or null (if convergence hit); just assert no throw
        expect(next !== undefined).toBe(true);
      });
    });
    ```

    IMPORTANT: In these test files, use top-level `await import(...)` after vi.mock() calls. This is the correct ESM pattern for Vitest — static imports would resolve before mocks are hoisted.

    After writing the files, read `examples/social-server/src/coordinator/ContestCoordinator.ts` to confirm the exact method names (`createContest`, `getEngine`) match what's in code. Adjust test method names if different.
  </action>
  <verify>
    `cd examples/social-server && npx vitest run` — exits 0, all route and coordinator tests pass. If a test fails due to a method name mismatch, fix the test to match the actual API — do not change source files.
  </verify>
  <done>
    - 3 test files exist under examples/social-server/src/test/
    - /health 200 and 503 cases pass
    - ContestCoordinator create + getEngine + nextPair pass
    - vote route 400 (invalid body) case passes
    - Vitest exits 0
  </done>
</task>

## Success Criteria
- [ ] vitest.config.ts, shared mocks, and "test" script wired up
- [ ] /health, vote route validation, ContestCoordinator create/get all tested
- [ ] No test requires a live Redis or BullMQ process
- [ ] `vitest run` exits 0
