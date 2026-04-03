---
phase: 17
plan: 3
wave: 2
---

# Plan 17.3: Split Benchmark Suite and Add Coverage Workflow

## Objective
Separate long-running benchmark workloads from default test runs and add explicit coverage workflow/scripts to satisfy Phase 17 verification targets.

**Depends on**: Plan 17.2

## Context
- `.gsd/ROADMAP.md`
- `.gsd/phases/17/RESEARCH.md`
- `packages/core/package.json`
- `packages/core/test/benchmark/load.test.ts`
- `packages/core/test/research/benchmark_sort.ts`

## Tasks

<task type="auto">
  <name>Create dedicated bench suite and bench config</name>
  <files>packages/core/bench/load.bench.test.ts, packages/core/vitest.config.bench.ts, packages/core/test/benchmark/load.test.ts</files>
  <action>
    Move benchmark execution out of default test discovery.

    1. Create `bench/` directory and move/recreate benchmark workload there.
    2. Add `vitest.config.bench.ts` with bench-only include patterns.
    3. Remove or retire the old benchmark file from default `test/` path.
    4. Keep benchmark scenarios for N=1000 and N=5000.

    Avoid:
    - Duplicating benchmark logic in both `test/` and `bench/`.
    - broad include patterns that pull benchmarks back into default test runs.
  </action>
  <verify>cd packages/core; npx vitest run --config vitest.config.bench.ts --reporter=verbose</verify>
  <done>
    - Bench tests run via bench config and include both N=1000 and N=5000 scenarios.
    - Default `npm test` no longer picks benchmark simulations.
  </done>
</task>

<task type="auto">
  <name>Add scripts and complete Phase 17 verification run</name>
  <files>packages/core/package.json, packages/core/vitest.config.ts</files>
  <action>
    Add scripts and run end-to-end checks against roadmap bullets.

    1. In `packages/core/package.json` add:
       - `"bench": "vitest run --config vitest.config.bench.ts"`
       - `"coverage": "vitest run --coverage"`

    2. Configure coverage include/exclude/thresholds in `vitest.config.ts` if missing.
       - Ensure core logic target is at least 80% line coverage.

    3. Execute and record outcomes:
       - `npm test`
       - `npm run bench`
       - `npm run coverage`

    4. If test runtime is above roadmap target, apply minimal discovery/config fixes and rerun.

    Avoid:
    - Relaxing assertions purely to force green checks.
    - Changing production code behavior in this task unless required for broken tests.
  </action>
  <verify>cd packages/core; npm test; npm run bench; npm run coverage</verify>
  <done>
    - `bench` and `coverage` scripts are present and runnable.
    - Default test run excludes benchmark suite.
    - Coverage run reports at least 80% lines for core logic.
    - Phase 17 verification commands pass.
  </done>
</task>

## Success Criteria
- [ ] Benchmark workloads are isolated behind dedicated bench config.
- [ ] `npm test` is fast-path and benchmark-free.
- [ ] `npm run bench` and `npm run coverage` scripts are available and validated.
- [ ] Phase 17 roadmap verification bullets are fully covered by executable checks.
