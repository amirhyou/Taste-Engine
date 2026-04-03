---
phase: 12
level: 2
researched_at: 2026-04-03
---

# Phase 12 Research: Quality Assurance & Hardening

## Questions Investigated

1. How should `@testing-library/react-native` be set up in the Expo (v54) project — what preset, what Jest config, and how do you mock native modules?
2. What is the right pattern for testing async hooks (`useContestVoting`, `useEngineStatus`) that depend on external service calls and React Native modules?
3. How do you add a Vitest suite to the social server (`examples/social-server`) — what config, how do you mock `ioredis` and `BullMQ` in ESM?
4. Which `@hono/zod-validator` API is current and what changed from v0.2?
5. What is the correct Zod pattern for safely deserializing MMKV-persisted JSON (storage validation, version mismatch)?
6. What is involved in upgrading Expo SDK from v54 to v55+? What are the breaking changes and do they affect our app?
7. How does the current `StorageService.getJSON<T>` unsafe cast get replaced with validated schemas?

---

## Findings

### Test Coverage Baseline

**Current state (code audit):**
- `packages/core` — Vitest-based, healthy test suite (`test/` contains engine, model, confidence, lifecycle, utils); ratio currently approximately 1:1.5.
- `examples/mobile-app` — No test infrastructure at all. `react-test-renderer` is a `devDependency` but no test runner, no Jest config, no test files.
- `examples/social-server` — No test infrastructure. No `vitest`/`jest` devDependency, no test script.
- `examples/react-web` — No tests, but Vite project is straightforward to add Vitest to.

**Implication:** All three non-core packages need test infrastructure to be bootstrapped from zero, not just coverage extended.

---

### Mobile Testing: @testing-library/react-native + Jest in Expo

**Setup requirements (from RNTL v13 docs):**
- Install: `@testing-library/react-native`, `jest-expo` (Expo's preconfigured Jest preset), `@types/jest`.
- `jest-expo` replaces the plain `react-native` preset and handles Expo-specific transforms (Reanimated, Expo Router, polyfills).
- `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
```

- Native modules that don't have a JS fallback (MMKV, NetInfo, Reanimated) must be manually mocked in `__mocks__/` or via `jest.mock()` calls.
- Key mocks needed:
  - `react-native-mmkv` → return a `Map`-backed storage object
  - `@react-native-community/netinfo` → return mock state + `addEventListener`
  - `expo-secure-store` → mock `getItemAsync`/`setItemAsync`
  - `expo-auth-session` → mock `useAuthRequest`

**Hook testing pattern (`renderHook` + `act`):**

```ts
import { renderHook, act } from '@testing-library/react-native';
import { useEngineStatus } from '../src/hooks/useEngineStatus';

it('returns not-ready before items loaded', async () => {
  const { result } = renderHook(() => useEngineStatus());
  expect(result.current.status).toBe('not-ready');
});
```

**Async hooks:** `renderHookAsync` / `waitFor` handle hooks with async `useEffect` fetches.

**Critical paths to test:**
1. `useContestVoting` — offline enqueue path (queue fills when `socialApi` throws); drain path when connectivity restored.
2. `useEngineStatus` — transitions (`not-ready` → `ready` → `done`).
3. `StorageService.getJSON` → `null` for malformed JSON.

**Sources:**
- Context7: /callstack/react-native-testing-library v13.3.3
- https://github.com/callstack/react-native-testing-library/blob/main/website/docs/13.x/docs/api/misc/render-hook.mdx
- https://github.com/callstack/react-native-testing-library/blob/main/website/docs/12.x/cookbook/advanced/network-requests.md

**Recommendation:** Use `jest-expo` preset + RNTL v13. Mock all native modules at the `__mocks__` level so all test files benefit automatically. Start with `useContestVoting` (offline enqueue) and `StorageService` (JSON validation) as they cover the highest-risk paths shipped in Phase 10.

---

### Server Testing: Vitest for Hono + Redis + BullMQ

**Setup approach:**

The social server is a plain Node ESM TypeScript project (`"type": "module"` implied by Hono/Node.js usage). Adding Vitest requires:

1. Install: `vitest`, `@vitest/coverage-v8` as devDependencies.
2. `vitest.config.ts` at `examples/social-server/`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

3. Add `"test": "vitest run"` to server `package.json` scripts.

**Mocking `ioredis`:**
- Use `vi.mock('ioredis')` with a lightweight factory. Pattern:

```ts
vi.mock('ioredis', () => {
  const store = new Map<string, string>();
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
      set: vi.fn((k: string, v: string) => { store.set(k, v); return Promise.resolve('OK'); }),
      del: vi.fn((k: string) => { store.delete(k); return Promise.resolve(1); }),
      ping: vi.fn(() => Promise.resolve('PONG')),
      status: 'ready',
    })),
  };
});
```

**Mocking `BullMQ`:**

```ts
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(() => Promise.resolve({ id: 'mock-job-id' })),
  })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}));
```

**Testing Hono routes directly (no HTTP layer):**
Hono's `app.request()` test helper allows route testing without a real server:

```ts
import { app } from '../../src/api/routes';

it('GET /health returns 200', async () => {
  const res = await app.request('/health');
  expect(res.status).toBe(200);
});
```

**Critical paths to test:**
1. Vote flow: POST `/contests/:id/vote` → validates schema → calls dispatcher → returns next pair.
2. Redis ops: `ContestCoordinator.createContest()` / `getOrCreate()`.
3. `RedisDispatcher` — pair lock, cooldown, seen set logic.
4. Rate limiting middleware (mock Redis ping counts).

**Sources:**
- Context7: /vitest-dev/vitest (mocking guide, vi.mock ESM hoisting)
- Context7: /websites/hono_dev (Hono testing docs)

**Recommendation:** Add Vitest with in-memory Redis mock to the social server. Avoid real Redis in CI; use the Map-backed vi.mock pattern. Test routes via `app.request()` without needing a network layer.

---

### Type Safety at Boundaries: Zod for Mobile Storage

**Problem:** `StorageService.getJSON<T>` casts blindly with `JSON.parse as T` — no runtime validation, no version check. A schema change to persisted state between app versions will silently corrupt the running app.

**Recommended pattern using Zod `safeParse`:**

```ts
import { z } from 'zod';
import { StorageService } from './storage';

const EngineSnapshotSchema = z.object({
  version: z.literal(1),
  items: z.array(z.string()),
  // ... etc
});

export function loadSnapshot(key: string) {
  const raw = StorageService.getJSON<unknown>(key); // unknown, not T
  if (!raw) return null;
  const result = EngineSnapshotSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[storage] Schema mismatch on load, clearing:', result.error.issues);
    StorageService.delete(key);
    return null;
  }
  return result.data;
}
```

**Version mismatch strategy:**
- Add a `version` literal field to every persisted schema (`z.literal(1)`).
- On `safeParse` failure, log and delete stale data rather than crashing — fail-open with re-initialization.
- Avoid `z.parse()` (throws) in storage reads; `z.safeParse()` everywhere.

**Where to apply:**
1. `sessionManager.ts` — engine snapshot deserialization.
2. `voteQueue.ts` — persisted queue deserialization.
3. `myContests.ts` — stored contest list.
4. API response validation in `socialApi.ts` (validate server responses before trusting them).

**Sources:**
- Context7: /colinhacks/zod v3.24.2 (safeParse, discriminated union result)

**Recommendation:** Define Zod schemas in a new `src/schemas/` directory inside mobile-app. Replace `getJSON<T>` call sites with `getValidatedJSON(key, schema)` utility that wraps `safeParse` with stale-data eviction. This is a ~1-2 day effort touching 4 files.

---

### Infrastructure: Expo SDK v54 → v55 Upgrade

**Upgrade procedure (from Expo docs):**

```sh
npm install expo@^55.0.0
npx expo install --fix   # auto-aligns all SDK package versions
npx expo-doctor          # validates compatibility
```

**Breaking changes relevant to this app:**

| Change | Impact |
|--------|--------|
| `newArchEnabled` in `app.json` has no effect in SDK 55+ (New Arch always on) | Low — app uses Reanimated 4 which supports New Arch |
| `expo-router` v6 → v7 included in SDK 55 | Medium — file-based routing API mostly stable; `unstable-native-tabs` API changed |
| React Native version bump (0.81.5 → 0.77.x range in SDK 55) | Medium — check for deprecations in core components |
| `react-native-reanimated` 4.x — verify worklets compat | Low — already on ~4.1.1 |
| `expo-auth-session` v7 → v8 | Low — PKCE flow API unchanged |
| `@react-native-community/slider` — ensure compatible version | Review |

**Known safe packages for SDK 55:**
- `expo-secure-store`, `expo-haptics`, `expo-constants`, `expo-font`, `expo-splash-screen` — minor version bumps, API stable.
- `react-native-mmkv` v4.x — tested with New Arch.

**Testing requirements:** After upgrade, validate on both iOS simulator and Android emulator (not just Expo Go, since New Arch behavior differences can only be caught in a dev build).

**Sources:**
- Context7: /websites/expo_dev_versions_v55_0_0
- Context7: /expo/expo (upgrade walkthrough, New Arch migration guide)

**Recommendation:** Upgrade is straightforward via `npx expo install --fix`. The only risk is expo-router v6→v7 API changes in layout files; do a targeted audit of `app/(tabs)/_layout.tsx` and `app/_layout.tsx` against v7 docs before applying. Budget 1 day including iOS + Android smoke testing.

---

### @hono/zod-validator Update

**Current version in server:** `^0.2.0`

**API status:** The `@hono/zod-validator` v0.4+ changed the `zValidator` factory signature to support custom result handling. The `hook` option was introduced. Core usage unchanged:

```ts
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

app.post('/vote', zValidator('json', VoteSchema), (c) => {
  const data = c.req.valid('json'); // still works exactly the same
  // ...
});
```

The existing pattern in `routes.ts` uses manual `z.safeParse()` rather than `zValidator` middleware, so upgrading the package version is low-risk. Run `npx expo install --fix` equivalent (`npm update @hono/zod-validator`) and verify no TypeScript errors.

**Recommendation:** Bump `@hono/zod-validator` to latest (`^0.4.x`). No route code changes required given manual parse pattern already in use.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mobile test runner | `jest-expo` preset + RNTL v13 | `jest-expo` is the official Expo-maintained preset; handles all native transforms automatically |
| Server test runner | Vitest (not Jest) | Already used in `packages/core`; consistent tooling across monorepo; native ESM support |
| Redis mock strategy | `vi.mock('ioredis')` with Map-backed factory | Avoids real Redis in CI; deterministic; fast |
| Storage validation | Zod `safeParse` + stale-data eviction | Fail-open is safer than crashing on mismatch; matches existing Zod dependency |
| Expo upgrade path | `npx expo install --fix` then `expo-doctor` | Official documented path; auto-aligns all SDK packages |
| New Architecture | Accept as always-on in SDK 55 | App already uses Reanimated 4 + MMKV 4 which both support New Arch |

---

## Patterns to Follow

- Mock native modules at `__mocks__/` directory level, not inline per test, so all test files benefit.
- Use `renderHookAsync` + `waitFor` for hooks with async `useEffect` fetches rather than `act(() => {})` hacks.
- Use `app.request()` (Hono test helper) for route tests — no `supertest` needed with Hono.
- All storage reads of persisted user data must go through `safeParse`, never `as T`.
- Each persisted schema must carry a `version: z.literal(N)` field to detect stale data.

---

## Anti-Patterns to Avoid

- **`react-native` preset (non-expo)**: Does not handle Expo module transforms; use `jest-expo` instead.
- **Real ioredis in unit tests**: Requires a live Redis process; makes CI brittle; use the Map mock.
- **`z.parse()` in storage reads**: Throws on malformed data and crashes the app; always use `safeParse`.
- **Upgrading Expo with plain `npm update`**: Misaligns SDK dependencies; use `npx expo install --fix`.
- **BullMQ Worker in test**: Workers spawn real threads; always mock at the module level in unit tests.

---

## Dependencies Identified

| Package | Version | Location | Purpose |
|---------|---------|----------|---------|
| `jest-expo` | `~54.0.0` | mobile-app devDep | Expo Jest preset with correct transforms |
| `@testing-library/react-native` | `^13.0.0` | mobile-app devDep | Hook + component test utilities |
| `@types/jest` | `^29.0.0` | mobile-app devDep | Jest type definitions |
| `vitest` | `^2.1.8` | social-server devDep | Test runner (matches packages/core version) |
| `@vitest/coverage-v8` | `^2.1.8` | social-server devDep | Code coverage |
| `zod` | Already present | mobile-app | Storage schema validation (no new dep) |
| `expo` | `^55.0.0` | mobile-app | SDK upgrade |

---

## Risks

- **Expo Router v6→v7 layout API changes**: `unstable-native-tabs` import path changed between versions — audit `app/(tabs)/_layout.tsx` before upgrading; mitigation: test with `expo-doctor` output before and after.
- **MMKV + New Architecture**: MMKV v4.x supports New Arch, but confirm with a dev build (not Expo Go); mitigation: include manual device test in Phase 12 verification.
- **Mobile test isolation**: `react-native-reanimated` requires worklet setup in Jest; `jest-expo` handles this, but verify the `transformIgnorePatterns` covers all animation-related packages.
- **Social server ESM mocking**: `ioredis` and `bullmq` are CJS/ESM hybrid packages; Vitest's `vi.mock` hoisting must be verified; mitigation: use factory pattern, not `vi.spyOn` on imports.

---

## Ready for Planning

- [x] Questions answered
- [x] Approach selected for all three test targets (mobile, server, web)
- [x] Zod storage validation pattern defined
- [x] Expo upgrade path and risks documented
- [x] Dependencies identified with no new mobile-side deps beyond test tooling
