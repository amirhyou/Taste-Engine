---
phase: 13
plan: 2
wave: 1
---

# Plan 13.2: Package Publish Readiness

## Objective
Make `@taste-engine/core` and `@taste-engine/adapters` ready for their first npm publish: add missing `"license"` field, add `prepublishOnly` to adapters, verify real exports exist, and create the initial Changeset that will be used for the first manual publish.

## Context
- .gsd/SPEC.md
- .gsd/phases/13/RESEARCH.md
- packages/core/package.json
- packages/adapters/package.json
- packages/adapters/src/index.ts
- .changeset/config.json

## Tasks

<task type="auto">
  <name>Add license field and prepublishOnly to both package.json files</name>
  <files>
    packages/core/package.json
    packages/adapters/package.json
  </files>
  <action>
    **packages/core/package.json** — add `"license": "MIT"` after the `"files"` field. The field already has `prepublishOnly` — do not change it.

    **packages/adapters/package.json** — two changes:
    1. Add `"license": "MIT"` after the `"files"` field (if `"files"` is absent, add it before `"scripts"`: `"files": ["dist"]`)
    2. Add `"prepublishOnly": "npm run build"` to the `"scripts"` object

    Both changes match the LICENSE file (MIT) in the workspace root.

    Do NOT add `"private": true` to either package — that would prevent publishing.
    Do NOT change version numbers.
  </action>
  <verify>
    # PowerShell
    $core = Get-Content "packages/core/package.json" | ConvertFrom-Json
    $adapters = Get-Content "packages/adapters/package.json" | ConvertFrom-Json
    Write-Host "core license: $($core.license)"
    Write-Host "adapters license: $($adapters.license)"
    Write-Host "adapters prepublishOnly: $($adapters.scripts.prepublishOnly)"
  </verify>
  <done>
    - `packages/core/package.json` has `"license": "MIT"`
    - `packages/adapters/package.json` has `"license": "MIT"` and `"scripts.prepublishOnly": "npm run build"`
  </done>
</task>

<task type="auto">
  <name>Create initial Changeset for first release</name>
  <files>.changeset/initial-release.md</files>
  <action>
    Verify `packages/adapters/src/index.ts` exports real symbols (Zod schemas + codecs + Hono/Express validators). It should — Phase 12 added them. If the file only contains `export const adaptersPlaceholder = true`, STOP and note this in a comment; do not create the changeset for adapters in that case.

    Assuming exports are real, create `.changeset/initial-release.md` with this content:

    ```markdown
    ---
    "@taste-engine/core": minor
    "@taste-engine/adapters": minor
    ---

    Initial public release of @taste-engine/core and @taste-engine/adapters.

    - `@taste-engine/core`: Pure TypeScript TrueSkill-based pairwise ranking engine with confidence-based stopping, active pair selection, and Monte Carlo convergence detection.
    - `@taste-engine/adapters`: Zod schemas, JSON codecs, and Hono/Express request validators for Taste Engine data types.
    ```

    Notes:
    - `minor` bump takes both packages from `0.1.0` → `0.2.0` (appropriate for first intentional public release from a pre-release state)
    - The `.changeset/config.json` already has `"access": "public"` — scoped packages default to private, this override is required
    - This changeset will be consumed when `npm run version-packages` runs (either manually or via the Release GitHub Action)
    - Do NOT run `changeset publish` now — that is a manual human step after verifying the workflows are live
  </action>
  <verify>Test-Path ".changeset/initial-release.md"</verify>
  <done>
    - `.changeset/initial-release.md` exists
    - Contains `"@taste-engine/core": minor` and `"@taste-engine/adapters": minor`
    - Both package.json files have `"license": "MIT"`
  </done>
</task>

## Success Criteria
- [ ] `packages/core/package.json` has `"license": "MIT"`
- [ ] `packages/adapters/package.json` has `"license": "MIT"` and `"prepublishOnly": "npm run build"`
- [ ] `.changeset/initial-release.md` exists with minor bump for both packages
- [ ] `npm run build -w packages/adapters` exits 0 (verify adapters builds cleanly)
