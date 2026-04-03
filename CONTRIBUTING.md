# Contributing to Taste Engine

## Prerequisites
- Node.js 20+
- npm 10+ (ships with Node 20)

## Setup

```bash
git clone https://github.com/YOUR_ORG/taste-engine.git
cd taste-engine
npm install
```

## Running Tests

```bash
npm run test -w packages/core       # Unit tests (Vitest)
npm run typecheck                    # Full monorepo type check
```

## Making Changes

Work in `packages/core` or `packages/adapters`. Examples in `examples/` are private packages and are never published.

## Versioning with Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

### When to add a changeset

Add a changeset for any change that affects `@taste-engine/core` or `@taste-engine/adapters`:
- New features → `minor`
- Bug fixes → `patch`
- Breaking changes → `major`

### How to add a changeset

```bash
npx changeset
```

Follow the prompts:
1. Select the package(s) affected
2. Choose `patch`, `minor`, or `major`
3. Write a short description of the change

This creates a `.changeset/*.md` file. **Commit it with your PR.**

### Release flow

1. PRs with changeset files are merged to `main`
2. The Release GitHub Action automatically creates a **Version PR** (`chore: version packages`)
3. Merging the Version PR updates `CHANGELOG.md` files and bumps versions
4. On merge, the action publishes to npm automatically

> **Note:** The very first release must be done manually:
> ```bash
> npm run release
> ```
> Subsequent releases are fully automated.

## Required GitHub Actions Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | How to obtain |
|--------|---------------|
| `NPM_TOKEN` | npmjs.com → Access Tokens → Generate New Token (Automation type, scoped to `@taste-engine`) |
| `FLY_API_TOKEN` | `fly tokens create deploy -a taste-engine-social` |

## Social Server

The social server in `examples/social-server/` deploys to Fly.io.

**First-time deploy:**
```bash
fly launch --config examples/social-server/fly.toml
fly secrets set REDIS_URL=<your-redis-url>
fly deploy --config examples/social-server/fly.toml
```

Subsequent deploys happen automatically via the Release GitHub Action when `examples/social-server/` files change on `main`.

## Project Structure

```
packages/
  core/       # @taste-engine/core — published to npm
  adapters/   # @taste-engine/adapters — published to npm
examples/
  mobile-app/     # Expo React Native (private)
  react-web/      # Vite React (private)
  node-cli/       # Node.js REPL (private)
  social-server/  # Hono server + BullMQ (private, deployed to Fly.io)
```
