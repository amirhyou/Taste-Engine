---
phase: 13
level: 2
researched_at: 2026-04-03
---

# Phase 13 Research — CI/CD & Package Publishing

## Questions Investigated
1. Should we use Changesets (already installed) or switch to semantic-release?
2. What GitHub Actions CI workflow fits this TypeScript monorepo?
3. How do we publish scoped `@taste-engine/*` packages to npm correctly?
4. Is `@taste-engine/adapters` ready to publish after Phase 12?
5. What is the social-server deployment strategy?
6. What developer-experience collateral (CONTRIBUTING.md, etc.) is needed?

---

## Findings

### 1. Changesets vs. semantic-release

**Decision: Stay with Changesets.**

The project already has full Changesets scaffolding:
- `@changesets/cli ^2.29.8` in root `devDependencies`
- `.changeset/config.json` configured with `"access": "public"`, `baseBranch: "main"`
- Root `package.json` scripts: `version-packages` and `release`

`semantic-release` would require ripping all of this out and rebuilding. Changesets is the better fit for a monorepo with multiple publishable packages because it handles per-package version bumps and changelogs natively.

**Sources:**
- https://github.com/changesets/changesets/blob/main/packages/cli/README.md
- https://github.com/changesets/action/blob/main/README.md

**Recommendation:** Keep Changesets, wire it into GitHub Actions.

---

### 2. GitHub Actions CI Workflow

**Two workflows needed:**

#### A. `ci.yml` — run on every push + PR
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

#### B. `release.yml` — run on push to `main`, auto-publish via changesets
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

**Note:** The monorepo uses `npm` (not yarn). `package-lock.json` exists so `npm ci` is correct.

**Sources:**
- https://github.com/changesets/action/blob/main/README.md

---

### 3. npm Package Publishing Setup

Both packages are properly structured for publishing:

| Package | `files` | `exports` | `access` |
|---------|---------|-----------|---------|
| `@taste-engine/core` | `["dist"]` | ESM + types | `public` (via `.changeset/config.json`) |
| `@taste-engine/adapters` | `["dist"]` | ESM + types | `public` |

**Checklist complete:**
- `"type": "module"` ✅
- `"main"` + `"types"` fields ✅
- `"exports"` map ✅
- `"prepublishOnly"` script (core only — adapters needs one added) ⚠️
- `"private": true` absent from both packages ✅
- `"license"` field missing from both package.json files ⚠️ — should add `"license": "MIT"` to match LICENSE file

**Required secret:** `NPM_TOKEN` with `publish` permissions scoped to `@taste-engine` org/namespace on npmjs.com.

---

### 4. `@taste-engine/adapters` Publish Readiness

**Current state:** `packages/adapters/src/index.ts` exports only `adaptersPlaceholder = true`. It is **not ready to publish**.

Phase 12 adds Zod schemas and serializers. After Phase 12 completes, adapters will have real exports. Phase 13 must verify adapters content before including it in the first publish.

**Recommendation:** Gate adapters publishing — include it in the v1.2 release only if Phase 12 adds meaningful implementation. Use `"ignore": ["@taste-engine/adapters"]` in `.changeset/config.json` as a fallback if not ready, publishing only `@taste-engine/core` first.

---

### 5. Social Server Deployment Strategy

The social server has a working `Dockerfile` that builds from monorepo root. A `docker-compose.yml` is also present (includes Redis dependency).

**Deployment options evaluated:**

| Option | Pros | Cons |
|--------|------|------|
| **Railway** | Git-push deploy, Redis add-on, free tier | Vendor lock-in |
| **Render** | Docker support, free tier, auto-deploy from GitHub | Cold starts on free tier |
| **Fly.io** | Persistent volumes, global edge, `fly.toml` config | CLI-based setup |
| **Self-hosted VPS** | Full control, cheapest at scale | Manual ops burden |

**Recommendation:** Add a `fly.toml` or `render.yaml` to `examples/social-server/` to make deployment one-command. Fly.io is the best fit — supports Docker directly, persistent Redis addon, no cold starts, and has a CLI that can be scripted in CI.

A deployment CI step (separate from publish) can trigger `fly deploy` on push to `main` when social-server files change.

---

### 6. Developer Experience (DX) Collateral

**`CONTRIBUTING.md` (root level):**
Must document the Changesets workflow for contributors:
1. Make changes, create a changeset (`npx changeset`)
2. Choose patch/minor/major, describe the change
3. Commit the `.changeset/*.md` file with the PR
4. On merge to `main`, the Release action creates a Version PR
5. Merging the Version PR triggers publish

**Other collateral needed:**
- `packages/core/CHANGELOG.md` — auto-generated by Changesets on first publish
- `packages/adapters/CHANGELOG.md` — same
- `.github/PULL_REQUEST_TEMPLATE.md` — optional, encourages changeset inclusion
- Update root `README.md` with npm install instructions and badges

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Release tooling | **Changesets** | Already scaffolded; built for monorepos |
| CI runner | **GitHub Actions** | Standard, free for open-source |
| npm package manager in CI | **npm + `npm ci`** | Lock file present; consistent with workspace |
| Social server hosting | **Fly.io** | Docker-native, no cold starts, Redis addon |
| Adapters publish gating | **Conditional on Phase 12 content** | Cannot ship empty package to npm |

---

## Patterns to Follow
- Build packages before running changeset publish (ensures `dist/` is fresh)
- Use `concurrency` in release workflow to prevent overlapping runs
- Never commit `.npmrc` with tokens; inject via environment variable
- Keep `examples/*` as `private: true` — they must never be published to npm
- Add `"license"` fields to all publishable `package.json` files before first publish

## Anti-Patterns to Avoid
- **semantic-release**: Would discard existing Changesets scaffolding with no benefit
- **Publishing from local machine**: Loses audit trail, risks stale `dist/`
- **Manually bumping versions**: Bypasses changelog generation, creates drift
- **Publishing `@taste-engine/adapters` before Phase 12**: Publishes a placeholder package that misleads consumers

---

## Dependencies Identified

| Package | Version | Purpose |
|---------|---------|---------|
| `changesets/action` | `v1` | GitHub Action for automated version + publish |
| `actions/checkout` | `v4` | Standard checkout in CI |
| `actions/setup-node` | `v4` | Node.js setup with npm cache |
| `flyctl` (CLI) | latest | Fly.io deployment (if chosen) |

No new runtime npm dependencies needed for Phase 13.

---

## Risks

- **NPM org namespace**: `@taste-engine` org must exist on npmjs.com (or the packages published under a user scope); confirm before CI is wired
- **First publish is manual**: Changesets action publishes on the _second_ merge (first creates the Version PR); the very first release should be done manually with `npm run release` after adding an initial changeset
- **`dist/` not committed**: The `.gitignore` likely excludes `dist/`; CI must build before publishing — already accounted for in workflows above
- **Expo SDK upgrade (Phase 12)**: May introduce regressions in mobile app; Phase 13 should not start until Phase 12 `Verification` passes

---

## Ready for Planning
- [x] Questions answered
- [x] Approach selected (Changesets + GitHub Actions)
- [x] Dependencies identified
- [x] Deployment target evaluated (Fly.io recommended)
- [x] Gating condition established (Phase 12 must complete first)
