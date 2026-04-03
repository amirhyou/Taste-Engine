---
phase: 12
plan: 1
wave: 1
---

# Plan 12.1: Mobile Test Infrastructure + Critical Hook Tests

## Objective
Bootstrap the Jest/RNTL test stack in `examples/mobile-app` (it has zero test infrastructure today), then write tests for the three highest-risk paths from Phase 10: `StorageService.getJSON`, `useEngineStatus` state transitions, and `useContestVoting` offline enqueue.

## Context
- .gsd/RESEARCH.md (Phase 12 research — jest-expo setup, RNTL patterns, mock strategy)
- .gsd/phases/12/RESEARCH.md
- examples/mobile-app/package.json
- examples/mobile-app/src/services/storage.ts
- examples/mobile-app/src/hooks/useEngineStatus.ts
- examples/mobile-app/src/hooks/useContestVoting.ts
- examples/mobile-app/src/services/voteQueue.ts
- examples/mobile-app/src/services/socialApi.ts

## Tasks

<task type="auto">
  <name>Install test dependencies and create Jest config + native module mocks</name>
  <files>
    examples/mobile-app/package.json
    examples/mobile-app/jest.config.js (create)
    examples/mobile-app/__mocks__/react-native-mmkv.js (create)
    examples/mobile-app/__mocks__/@react-native-community/netinfo.js (create)
    examples/mobile-app/__mocks__/expo-secure-store.js (create)
  </files>
  <action>
    1. Add to `examples/mobile-app/package.json` devDependencies (do NOT run install, just edit the file):
       - `"jest-expo": "~54.0.0"`
       - `"@testing-library/react-native": "^13.0.0"`
       - `"@types/jest": "^29.0.0"`

    2. Create `examples/mobile-app/jest.config.js`:
    ```js
    /** @type {import('jest').Config} */
    module.exports = {
      preset: 'jest-expo',
      setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
      },
    };
    ```

    3. Create `examples/mobile-app/__mocks__/react-native-mmkv.js`:
    ```js
    const store = new Map();
    const MMKV = jest.fn().mockImplementation(() => ({
      getString: jest.fn((key) => store.get(key) ?? undefined),
      set: jest.fn((key, value) => store.set(key, value)),
      delete: jest.fn((key) => store.delete(key)),
    }));
    module.exports = { MMKV };
    ```

    4. Create `examples/mobile-app/__mocks__/@react-native-community/netinfo.js`:
    ```js
    const NetInfo = {
      fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
      addEventListener: jest.fn(() => jest.fn()),
    };
    module.exports = { default: NetInfo, ...NetInfo };
    ```

    5. Create `examples/mobile-app/__mocks__/expo-secure-store.js`:
    ```js
    const store = new Map();
    module.exports = {
      getItemAsync: jest.fn((key) => Promise.resolve(store.get(key) ?? null)),
      setItemAsync: jest.fn((key, value) => { store.set(key, value); return Promise.resolve(); }),
      deleteItemAsync: jest.fn((key) => { store.delete(key); return Promise.resolve(); }),
    };
    ```

    6. Add `"test": "jest"` script to `examples/mobile-app/package.json`.

    Do NOT add `"@testing-library/jest-native"` — RNTL v13 ships built-in matchers via `extend-expect`.
    Do NOT use `react-native` preset (not expo-aware).
  </action>
  <verify>
    After running `cd examples/mobile-app && npm install && npx jest --listTests` the jest runner initialises without errors (even with 0 test files).
  </verify>
  <done>
    - jest.config.js exists at examples/mobile-app/
    - All three __mocks__ files exist
    - devDependencies in package.json include jest-expo, @testing-library/react-native, @types/jest
    - `"test": "jest"` script present in package.json
  </done>
</task>

<task type="auto">
  <name>Write tests: StorageService.getJSON, useEngineStatus, useContestVoting offline enqueue</name>
  <files>
    examples/mobile-app/src/__tests__/storage.test.ts (create)
    examples/mobile-app/src/__tests__/useEngineStatus.test.ts (create)
    examples/mobile-app/src/__tests__/useContestVoting.test.ts (create)
  </files>
  <action>
    Create `examples/mobile-app/src/__tests__/storage.test.ts`:
    ```ts
    import { StorageService } from '../services/storage';

    describe('StorageService.getJSON', () => {
      it('returns null for missing key', () => {
        expect(StorageService.getJSON('nonexistent')).toBeNull();
      });

      it('returns parsed object for valid JSON', () => {
        StorageService.setJSON('test_key', { foo: 1 });
        expect(StorageService.getJSON('test_key')).toEqual({ foo: 1 });
      });

      it('returns null and does not throw for malformed JSON', () => {
        // Directly set a corrupt string bypassing setJSON
        StorageService.set('bad_key', '{not valid json}');
        expect(StorageService.getJSON('bad_key')).toBeNull();
      });
    });
    ```

    Create `examples/mobile-app/src/__tests__/useEngineStatus.test.ts`:
    ```ts
    import { renderHook, act } from '@testing-library/react-native';
    import { useEngineStatus } from '../hooks/useEngineStatus';
    import { engineManager } from '../services/engineManager';

    jest.mock('../services/engineManager', () => ({
      engineManager: {
        getEngine: jest.fn(),
      },
    }));

    const mockGetEngine = engineManager.getEngine as jest.Mock;

    describe('useEngineStatus', () => {
      it('returns null status when no engine is initialised', () => {
        mockGetEngine.mockImplementation(() => { throw new Error('no engine'); });
        const { result } = renderHook(() => useEngineStatus());
        expect(result.current.status).toBeNull();
        expect(result.current.stabilityScore).toBe(0);
      });

      it('returns stability score from engine', () => {
        mockGetEngine.mockReturnValue({
          status: () => ({ stability: 0.85, canStop: false }),
        });
        const { result } = renderHook(() => useEngineStatus());
        expect(result.current.stabilityScore).toBe(85);
      });

      it('shows Stable label when canStop is true', () => {
        mockGetEngine.mockReturnValue({
          status: () => ({ stability: 0.95, canStop: true }),
        });
        const { result } = renderHook(() => useEngineStatus());
        expect(result.current.label).toMatch(/Stable/);
      });
    });
    ```

    Create `examples/mobile-app/src/__tests__/useContestVoting.test.ts`:
    ```ts
    import { renderHook, act, waitFor } from '@testing-library/react-native';
    import { useContestVoting } from '../hooks/useContestVoting';
    import { socialApi } from '../services/socialApi';
    import { voteQueue } from '../services/voteQueue';

    jest.mock('../services/socialApi', () => ({
      socialApi: {
        getNextPair: jest.fn(),
        voteInContest: jest.fn(),
      },
    }));

    jest.mock('../services/retryBackoff', () => ({
      retryWithBackoff: jest.fn((fn) => fn()),
    }));

    const mockGetNextPair = socialApi.getNextPair as jest.Mock;
    const mockVoteInContest = socialApi.voteInContest as jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
      // Clear the queue between tests
      voteQueue.getQueue().forEach(v => voteQueue.remove(v.id));
    });

    describe('useContestVoting', () => {
      it('fetches initial pair on mount', async () => {
        mockGetNextPair.mockResolvedValueOnce({
          nextPair: { a: 'track-a', b: 'track-b' },
          pairMeta: null,
        });
        const { result } = renderHook(() => useContestVoting('contest-1', 'user-1'));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.currentPair).toEqual(['track-a', 'track-b']);
      });

      it('sets done=true when server returns null nextPair', async () => {
        mockGetNextPair.mockResolvedValueOnce({ nextPair: null });
        const { result } = renderHook(() => useContestVoting('contest-1', 'user-1'));
        await waitFor(() => expect(result.current.done).toBe(true));
      });

      it('does not fetch if contestId or userId is null', () => {
        renderHook(() => useContestVoting('', null));
        expect(mockGetNextPair).not.toHaveBeenCalled();
      });
    });
    ```

    Important:
    - Do NOT mock `voteQueue` — test it with the real (MMKV-mocked) implementation.
    - The `@react-native-community/netinfo` in `useContestVoting` is satisfied by the `__mocks__` file created in task 1.
    - Use `waitFor` (not `act`) for async state updates from `useEffect`.
  </action>
  <verify>
    `cd examples/mobile-app && npx jest src/__tests__` — all 9 tests pass, 0 failures.
  </verify>
  <done>
    - 3 test files exist under examples/mobile-app/src/__tests__/
    - All tests cover: getJSON null, valid, malformed; engineStatus null engine, score calculation, Stable label; contestVoting initial fetch, done state, null guard
    - Jest exits 0
  </done>
</task>

## Success Criteria
- [ ] jest.config.js + 3 native module mocks in place
- [ ] 3 test files, 9+ test cases, all passing
- [ ] No test imports `react-native` preset or `@testing-library/jest-native`
