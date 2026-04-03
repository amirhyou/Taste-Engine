---
phase: 10
plan: 3
wave: 1
---

# Plan 10.3: Adapters Package — Zod Schemas & JSON Codecs

## Objective
Implement Zod validation schemas for `ComparisonEvent`, `RunConfig`, and `EngineSnapshot` in `packages/adapters`, along with a JSON codec (serialize/deserialize) for each. This makes the adapters package the single source of truth for cross-boundary validation. Runs in parallel with Plan 10.1.

## Context
- .gsd/phases/10/RESEARCH.md — Zod schema patterns, codec structure
- packages/core/src/types.ts — canonical TypeScript types to mirror in Zod
- packages/adapters/src/index.ts — currently a stub (exports placeholder only)
- packages/adapters/package.json — needs `zod` dependency added
- packages/adapters/tsconfig.json — reference for build config

## Tasks

<task type="auto">
  <name>Add zod dependency and create Zod schemas</name>
  <files>
    packages/adapters/package.json
    packages/adapters/src/schemas/comparisonEvent.ts
    packages/adapters/src/schemas/runConfig.ts
    packages/adapters/src/schemas/engineSnapshot.ts
  </files>
  <action>
    **1. Update `packages/adapters/package.json`:**
    - Add `"zod": "^3.22.0"` to `"dependencies"` (not devDependencies — consumers need it at runtime).

    **2. Create `packages/adapters/src/schemas/comparisonEvent.ts`:**
    Mirror `ComparisonEvent` from `packages/core/src/types.ts` exactly:
    ```typescript
    import { z } from 'zod';

    export const ComparisonResultSchema = z.enum(['a', 'b', 'tie', 'skip']);

    export const ComparisonEventSchema = z.object({
      a: z.string(),
      b: z.string(),
      result: ComparisonResultSchema,
      t: z.number(),
      userId: z.string().optional(),
      strength: z.number().optional(),
      context: z.union([z.string(), z.record(z.string())]).optional(),
    });

    export type ComparisonEvent = z.infer<typeof ComparisonEventSchema>;
    ```

    **3. Create `packages/adapters/src/schemas/runConfig.ts`:**
    Mirror `RunConfig` serializable fields (omit function types; use shape for pool/boundaryBand):
    ```typescript
    import { z } from 'zod';

    const DecayConfigSchema = z.discriminatedUnion('type', [
      z.object({ type: z.literal('none') }),
      z.object({ type: z.literal('window'), windowDays: z.number() }),
      z.object({ type: z.literal('exp'), halfLifeDays: z.number() }),
    ]);

    const PoolConfigSerializedSchema = z.object({
      startScale: z.number(),
      startMin: z.number(),
      tightScale: z.number(),
      tightMin: z.number(),
    });

    const BoundaryBandSerializedSchema = z.object({
      floorMin: z.number(),
      floorMax: z.number(),
      ratioN: z.number(),
      ratioK: z.number(),
    });

    export const RunConfigSerializedSchema = z.object({
      k: z.number().int().positive(),
      q: z.number(),
      tau: z.number(),
      beta: z.number(),
      decay: DecayConfigSchema,
      pool: PoolConfigSerializedSchema,
      boundaryBand: BoundaryBandSerializedSchema,
      explorationRate: z.number(),
      driftRate: z.number(),
      repeatCapPerPair: z.number().int(),
      minComparisonsPerItemSeed: z.number().int(),
      minUniqueOpponentsInPool: z.number().int(),
      onboarding: z.object({
        anchorsPerNewItem: z.number().int(),
        anchorStrategy: z.enum(['boundary+mid', 'midOnly']),
      }),
      confidence: z.object({
        samples: z.number().int(),
        challengerBandMultiplier: z.number(),
      }),
      cycleGuard: z.object({
        enabled: z.boolean(),
        alarmThreshold: z.number(),
      }),
    });

    export type RunConfigSerialized = z.infer<typeof RunConfigSerializedSchema>;
    ```

    **4. Create `packages/adapters/src/schemas/engineSnapshot.ts`:**
    Mirror `EngineSnapshot` from `packages/core/src/types.ts`:
    ```typescript
    import { z } from 'zod';
    import { ComparisonEventSchema } from './comparisonEvent';
    import { RunConfigSerializedSchema } from './runConfig';

    const ItemStateSerializedSchema = z.object({
      mu: z.number(),
      sigma: z.number(),
      games: z.number().int().nonnegative(),
      wins: z.number().int().nonnegative(),
      lastUpdatedAt: z.number(),
      uniqueOpponents: z.array(z.string()),
    });

    export const EngineSnapshotSchema = z.object({
      config: RunConfigSerializedSchema,
      items: z.array(z.string()),
      states: z.record(ItemStateSerializedSchema),
      pairCounts: z.record(z.number()),
      events: z.array(ComparisonEventSchema),
    });

    export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
    ```
  </action>
  <verify>cd packages/adapters ; npx tsc -p tsconfig.json --noEmit</verify>
  <done>All three schema files compile; inferred types match core types structure; zod in dependencies</done>
</task>

<task type="auto">
  <name>Add JSON codecs and update package exports</name>
  <files>
    packages/adapters/src/codecs/json.ts
    packages/adapters/src/index.ts
  </files>
  <action>
    **1. Create `packages/adapters/src/codecs/json.ts`:**

    Provide type-safe parse + stringify wrappers for each schema:

    ```typescript
    import { z } from 'zod';
    import { ComparisonEventSchema } from '../schemas/comparisonEvent';
    import { RunConfigSerializedSchema } from '../schemas/runConfig';
    import { EngineSnapshotSchema } from '../schemas/engineSnapshot';

    function makeJsonCodec<T extends z.ZodTypeAny>(schema: T) {
      return {
        parse(json: string): z.infer<T> {
          const raw = JSON.parse(json);          // throws SyntaxError on malformed JSON
          return schema.parse(raw);              // throws ZodError on invalid shape
        },
        stringify(value: z.infer<T>): string {
          schema.parse(value);                   // validate before serializing
          return JSON.stringify(value);
        },
        safeParse(json: string): { success: true; data: z.infer<T> } | { success: false; error: Error } {
          try {
            return { success: true, data: this.parse(json) };
          } catch (e) {
            return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
          }
        },
      };
    }

    export const ComparisonEventCodec = makeJsonCodec(ComparisonEventSchema);
    export const RunConfigCodec = makeJsonCodec(RunConfigSerializedSchema);
    export const EngineSnapshotCodec = makeJsonCodec(EngineSnapshotSchema);
    ```

    **2. Replace `packages/adapters/src/index.ts`** (currently a one-line stub):
    Export everything from schemas and codecs:
    ```typescript
    // Schemas
    export { ComparisonEventSchema, ComparisonResultSchema } from './schemas/comparisonEvent';
    export type { ComparisonEvent } from './schemas/comparisonEvent';
    export { RunConfigSerializedSchema } from './schemas/runConfig';
    export type { RunConfigSerialized } from './schemas/runConfig';
    export { EngineSnapshotSchema } from './schemas/engineSnapshot';
    export type { EngineSnapshot } from './schemas/engineSnapshot';

    // Codecs
    export { ComparisonEventCodec, RunConfigCodec, EngineSnapshotCodec } from './codecs/json';
    ```

    Do NOT export `adaptersPlaceholder` anymore.
  </action>
  <verify>cd packages/adapters ; npx tsc -p tsconfig.json --noEmit</verify>
  <done>Codecs compile; index.ts exports all schemas and codecs; placeholder removed; parse/stringify/safeParse all present</done>
</task>

## Success Criteria
- [ ] Three Zod schema files created matching core types exactly
- [ ] JSON codec exported for each schema with parse / stringify / safeParse
- [ ] `index.ts` updated — placeholder removed, all schemas and codecs re-exported
- [ ] `zod` in `dependencies` (not devDependencies)
- [ ] `packages/adapters` builds cleanly via `tsc`
