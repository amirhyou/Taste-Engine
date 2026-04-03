---
phase: 13
plan: 1
wave: 1
---

# Plan 13.1: GitHub Actions CI/CD Workflows

## Objective
Wire up automated CI (build + test on every push/PR) and an automated Release workflow (Changesets-powered version PR + npm publish). These two YAML files are the automation backbone for the entire publishing pipeline.

## Context
- .gsd/SPEC.md
- .gsd/ARCHITECTURE.md
- .gsd/phases/13/RESEARCH.md
- package.json (root — has `version-packages` and `release` scripts)
- packages/core/package.json
- packages/adapters/package.json

## Tasks

<task type="auto">
  <name>Create .github/workflows/ci.yml</name>
  <files>.github/workflows/ci.yml</files>
  <action>
    Create the directory `.github/workflows/` and the file `ci.yml` with this exact content:

    ```yaml
    name: CI

    on:
      push:
        branches: [main]
      pull_request:
        branches: [main]

    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-node@v4
            with:
              node-version: 20
              cache: npm
          - run: npm ci
          - run: npm run build -w packages/core
          - run: npm run build -w packages/adapters
          - run: npm run test -w packages/core
          - run: npm run typecheck
    ```

    Notes:
    - `npm ci` (not `npm install`) — uses package-lock.json for reproducible builds
    - Build both packages before running tests — `packages/core` test imports need compiled types
    - `npm run typecheck` runs `tsc -p tsconfig.base.json --noEmit` from root to catch cross-package type errors
    - Do NOT add `npm run test -w packages/adapters` — adapters has `"test": "echo 'No tests yet'"` and the echo exit code causes no harm, but it's noise; skip it for now
  </action>
  <verify>Test-Path ".github/workflows/ci.yml"</verify>
  <done>File exists; `name: CI` appears on line 1; workflow has `push`, `pull_request` triggers on `main`</done>
</task>

<task type="auto">
  <name>Create .github/workflows/release.yml</name>
  <files>.github/workflows/release.yml</files>
  <action>
    Create `.github/workflows/release.yml` with this exact content:

    ```yaml
    name: Release

    on:
      push:
        branches: [main]

    concurrency: ${{ github.workflow }}-${{ github.ref }}

    jobs:
      release:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
            with:
              fetch-depth: 0
          - uses: actions/setup-node@v4
            with:
              node-version: 20
              cache: npm
          - run: npm ci
          - run: npm run build -w packages/core
          - run: npm run build -w packages/adapters
          - uses: changesets/action@v1
            with:
              version: npm run version-packages
              publish: npm run release
              commit: "chore: version packages"
              title: "chore: version packages"
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
              NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    ```

    Notes:
    - `fetch-depth: 0` is required by Changesets action (needs full git history to generate changelogs)
    - `concurrency` key prevents two release jobs racing if commits land in quick succession
    - `npm run release` (root package.json) already does `npm run build && changeset publish` — do NOT add an extra build step inside changesets `publish`; the build above the action step satisfies the dist requirement and the `release` script re-runs it harmlessly
    - `NPM_TOKEN` must be added as a GitHub Actions secret by the repo owner — document this in CONTRIBUTING.md (Plan 13.4)
    - Do NOT add the social-server fly deploy step to this file — that is Plan 13.3
  </action>
  <verify>Test-Path ".github/workflows/release.yml"</verify>
  <done>File exists; `changesets/action@v1` present; `concurrency` key present; both `GITHUB_TOKEN` and `NPM_TOKEN` env vars referenced</done>
</task>

## Success Criteria
- [ ] `.github/workflows/ci.yml` exists and is valid YAML (no syntax errors)
- [ ] `.github/workflows/release.yml` exists and is valid YAML (no syntax errors)
- [ ] Both workflows use `actions/checkout@v4`, `actions/setup-node@v4` with Node 20 and npm cache
- [ ] Release workflow uses `changesets/action@v1` with correct `version` and `publish` commands
