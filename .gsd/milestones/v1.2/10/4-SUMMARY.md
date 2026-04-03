---
phase: 10
plan: 4
status: complete
completed_at: 2026-04-03
---

# Summary: Plan 10.4 — Adapters Framework Integrations & Publishability

## What Was Done

### Task 1: Framework middleware
Created `packages/adapters/src/integrations/hono/validator.ts`:
- Wraps `@hono/zod-validator`'s `zValidator` for `ComparisonEvent` and `EngineSnapshot`
- Exports `validateComparisonEvent()` and `validateEngineSnapshot()` factory functions

Created `packages/adapters/src/integrations/express/validator.ts`:
- Generic `zodBodyValidator<T>` factory returning Express-compatible middleware (`any` types, no express dep)
- Returns 400 JSON with `issues` array on validation failure
- Named exports for `validateComparisonEvent()` and `validateEngineSnapshot()`

Updated `packages/adapters/package.json`:
- `@hono/zod-validator` and `hono` in both `peerDependencies` (optional) and `devDependencies`
- `exports` field with `import` + `types` subpaths

### Task 2: Declarations + index + README
`packages/adapters/tsconfig.json` — `declaration: true` + `declarationMap: true` explicit.

`packages/adapters/src/index.ts` — integration re-exports appended with `honoValidate*` and `expressValidate*` aliases.

Created `packages/adapters/README.md` with codec, Hono, Express, and schema usage examples.

## Verification
- `npx tsc -p tsconfig.json --noEmit` in `packages/adapters`: **0 errors**
- `@hono/zod-validator@0.2.2` installed
