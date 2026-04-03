---
phase: 12
plan: 3
wave: 2
---

# Plan 12.3: Zod Storage Validation (Type Safety at Boundaries)

## Objective
Replace the four unsafe `getJSON<T>` call sites in mobile-app with Zod-validated loaders. Introduce a `src/schemas/` directory, define schemas with `version` literals for all persisted types, add a `getValidatedJSON` utility, and wire it into `sessionManager`, `voteQueue`, `myContests`, and the API response handling in `socialApi`.

## Context
- .gsd/phases/12/RESEARCH.md
- examples/mobile-app/src/services/storage.ts
- examples/mobile-app/src/services/sessionManager.ts
- examples/mobile-app/src/services/voteQueue.ts
- examples/mobile-app/src/services/myContests.ts
- examples/mobile-app/src/services/socialApi.ts

## Tasks

<task type="auto">
  <name>Create src/schemas/ with versioned Zod schemas and add getValidatedJSON to StorageService</name>
  <files>
    examples/mobile-app/src/schemas/index.ts (create)
    examples/mobile-app/src/services/storage.ts
  </files>
  <action>
    1. Read `examples/mobile-app/src/services/sessionManager.ts`, `voteQueue.ts`, `myContests.ts`, and `socialApi.ts` to confirm the exact shape of all persisted/received types before writing schemas.

    2. Create `examples/mobile-app/src/schemas/index.ts`:
    ```ts
    import { z } from 'zod';

    // ─── SessionMeta ──────────────────────────────────────────────────────────
    export const SessionMetaSchema = z.object({
      playlistId: z.string(),
      playlistName: z.string(),
      targetK: z.number(),
      lastActive: z.number(),
      status: z.enum(['active', 'archived']),
      engineVersion: z.string(),
    });
    export type SessionMeta = z.infer<typeof SessionMetaSchema>;

    export const SessionIndexSchema = z.record(SessionMetaSchema);

    // ─── PendingVote (voteQueue) ──────────────────────────────────────────────
    const VotePayloadSchema = z.object({
      userId: z.string(),
      pair: z.tuple([z.string(), z.string()]),
      choice: z.number(),
    });

    export const PendingVoteSchema = z.object({
      id: z.string(),
      contestId: z.string(),
      payload: VotePayloadSchema,
      enqueuedAt: z.number(),
      retryCount: z.number(),
    });

    export const VoteQueueSchema = z.array(PendingVoteSchema);

    // ─── SavedContest (myContests) ────────────────────────────────────────────
    export const SavedContestSchema = z.object({
      id: z.string(),
      title: z.string(),
      inviteCode: z.string(),
      published: z.boolean(),
      closed: z.boolean(),
      createdAt: z.number(),
    });

    export const SavedContestListSchema = z.array(SavedContestSchema);

    // ─── NextPairResult (API response) ───────────────────────────────────────
    const TrackMetaSchema = z.object({
      name: z.string(),
      artist: z.string().optional(),
      album: z.string().optional(),
      imageUrl: z.string().optional(),
      previewUrl: z.string().optional(),
    });

    export const NextPairResultSchema = z.object({
      nextPair: z.union([
        z.object({ a: z.string(), b: z.string() }),
        z.null(),
      ]),
      pairMeta: z.object({
        a: z.union([TrackMetaSchema, z.null()]),
        b: z.union([TrackMetaSchema, z.null()]),
      }).optional(),
    });
    ```

    3. Edit `examples/mobile-app/src/services/storage.ts` — add `getValidatedJSON` after the existing `getJSON` method:
    ```ts
    import type { ZodSchema } from 'zod';

    // Inside the StorageService object, after setJSON:
    getValidatedJSON: <T>(key: string, schema: ZodSchema<T>): T | null => {
      const val = mmkv.getString(key);
      if (!val) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(val);
      } catch {
        return null;
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        console.warn(`[storage] Schema validation failed for key "${key}":`, result.error.issues);
        mmkv.delete(key);
        return null;
      }
      return result.data;
    },
    ```

    Do NOT modify `getJSON` — it is still used for types not yet migrated and will be removed later.
    Do NOT import zod in storage.ts at the top level. Import the type only (`import type`) to keep the storage module lean.
    Zod is already a dependency in the mobile-app (transitively, but add it explicitly to package.json if missing).
  </action>
  <verify>
    `cd examples/mobile-app && npx tsc --noEmit` — no TypeScript errors in src/schemas/index.ts or src/services/storage.ts.
  </verify>
  <done>
    - src/schemas/index.ts exists with 5 schemas + inferred types
    - StorageService.getValidatedJSON exists and type-checks
    - No changes to getJSON signature
  </done>
</task>

<task type="auto">
  <name>Wire getValidatedJSON into sessionManager, voteQueue, myContests, and socialApi</name>
  <files>
    examples/mobile-app/src/services/sessionManager.ts
    examples/mobile-app/src/services/voteQueue.ts
    examples/mobile-app/src/services/myContests.ts
    examples/mobile-app/src/services/socialApi.ts
  </files>
  <action>
    Read each file fully before editing. Make the minimal changes to replace unsafe casts.

    **sessionManager.ts** — constructor reads session index:
    - Replace: `StorageService.getJSON<Record<string, SessionMeta>>(SESSION_INDEX_KEY) || {}`
    - With: `StorageService.getValidatedJSON(SESSION_INDEX_KEY, SessionIndexSchema) ?? {}`
    - Add import at top: `import { SessionIndexSchema } from '../schemas';`

    **voteQueue.ts** — `readQueue()` function:
    - Replace: `const data = StorageService.getJSON<PendingVote[]>(QUEUE_KEY);`
      with: `const data = StorageService.getValidatedJSON(QUEUE_KEY, VoteQueueSchema);`
    - Remove the `if (!Array.isArray(data))` guard (schema handles that)
    - Add import: `import { VoteQueueSchema } from '../schemas';`

    **myContests.ts** — `load()` function:
    - The function uses `SecureStore` / `localStorage`, not `StorageService.getJSON`. It does `JSON.parse(raw) as SavedContest[]`.
    - Replace the raw cast with a schema parse:
      ```ts
      import { SavedContestListSchema } from '../schemas';
      // In load():
      const parsed = SavedContestListSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return [];
      return parsed.data;
      ```

    **socialApi.ts** — `getNextPair` response:
    - Find the fetch call that returns `NextPairResult`. It likely does `return data as NextPairResult`.
    - Replace with:
      ```ts
      import { NextPairResultSchema } from '../schemas';
      // After const data = await res.json():
      const validated = NextPairResultSchema.safeParse(data);
      if (!validated.success) throw new Error('Invalid server response for nextPair');
      return validated.data;
      ```
    - If the function throws, `useContestVoting` already catches errors and sets `error` state — no further handling needed.

    After all edits, run typecheck. If `SessionMeta` type in `SessionManager` was imported from a local interface, update that import to use `import { SessionMeta } from '../schemas'` instead of the local definition to avoid duplicate type declarations.

    DO NOT change business logic. Only replace the unsafe parse/cast with the schema-validated version.
  </action>
  <verify>
    `cd examples/mobile-app && npx tsc --noEmit` — no errors.
    `cd examples/mobile-app && npx jest src/__tests__` — existing tests still pass.
  </verify>
  <done>
    - sessionManager constructor uses getValidatedJSON + SessionIndexSchema
    - voteQueue readQueue() uses getValidatedJSON + VoteQueueSchema
    - myContests load() uses SavedContestListSchema.safeParse
    - socialApi getNextPair validates against NextPairResultSchema
    - All TypeScript checks clean
    - All existing tests still pass
  </done>
</task>

## Success Criteria
- [ ] src/schemas/index.ts defines all 5 schemas with inferred types
- [ ] getValidatedJSON added to StorageService
- [ ] All 4 call sites wired to schema validation
- [ ] `npx tsc --noEmit` clean
- [ ] Existing jest tests still pass
