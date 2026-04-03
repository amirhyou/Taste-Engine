import { vi } from 'vitest';

export function createRedisMock() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

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
      keys.forEach((k) => store.delete(k));
      return Promise.resolve(keys.length);
    }),
    exists: vi.fn((...keys: string[]) =>
      Promise.resolve(keys.filter((k) => store.has(k)).length),
    ),
    ping: vi.fn(() => Promise.resolve('PONG' as const)),
    status: 'ready' as const,
    sadd: vi.fn((k: string, ...members: string[]) => {
      if (!sets.has(k)) sets.set(k, new Set());
      members.forEach((m) => sets.get(k)!.add(m));
      return Promise.resolve(members.length);
    }),
    sismember: vi.fn((k: string, member: string) =>
      Promise.resolve(sets.get(k)?.has(member) ? 1 : 0),
    ),
    setnx: vi.fn((k: string, v: string) => {
      if (store.has(k)) return Promise.resolve(0);
      store.set(k, v);
      return Promise.resolve(1);
    }),
    expire: vi.fn(() => Promise.resolve(1)),
    ttl: vi.fn(() => Promise.resolve(60)),
    incr: vi.fn((k: string) => {
      const n = parseInt(store.get(k) ?? '0', 10) + 1;
      store.set(k, String(n));
      return Promise.resolve(n);
    }),
    quit: vi.fn(() => Promise.resolve('OK' as const)),
    _store: store,
    _sets: sets,
  };
}
