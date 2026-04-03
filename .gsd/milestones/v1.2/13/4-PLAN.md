---
phase: 13
plan: 4
wave: 2
---

# Plan 13.4: Developer Experience

## Objective
Write `CONTRIBUTING.md` to document the Changesets workflow and required secrets, and update the root `README.md` with npm install instructions so consumers know the packages are published.

## Context
- .gsd/SPEC.md
- .gsd/phases/13/RESEARCH.md
- README.md (root)
- .changeset/config.json
- .github/workflows/release.yml (from Plan 13.1)
- .github/workflows/ci.yml (from Plan 13.1)

## Tasks

<task type="auto">
  <name>Create root CONTRIBUTING.md</name>
  <files>CONTRIBUTING.md</files>
  <action>
    Create `CONTRIBUTING.md` at the workspace root with this content:

    ```markdown
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
    ```

    Notes:
    - Use fenced code blocks inside markdown correctly — the triple backtick blocks within the markdown file must be escaped or handled properly. When writing the actual file, the outer markdown fences in this plan are just for display; write the file with normal ``` code fences.
    - Do NOT add a CODEOWNERS file or PR template — those are out of scope.
  </action>
  <verify>Test-Path "CONTRIBUTING.md"</verify>
  <done>File exists; contains `npx changeset`; documents `NPM_TOKEN` and `FLY_API_TOKEN` secrets; documents first-time fly deploy instructions</done>
</task>

<task type="auto">
  <name>Update root README.md with npm install instructions</name>
  <files>README.md</files>
  <action>
    The current README.md has no npm install instructions. Add an **Installation** section immediately after the opening description paragraph (before "## Key Features") with this content:

    ```markdown
    ## Installation

    ```bash
    npm install @taste-engine/core
    ```

    For validation schemas, codecs, and Hono/Express adapters:

    ```bash
    npm install @taste-engine/adapters
    ```
    ```

    Also add npm version badges at the very top of the file, on the line immediately after `# Taste Engine`:

    ```markdown
    [![npm](https://img.shields.io/npm/v/@taste-engine/core)](https://www.npmjs.com/package/@taste-engine/core)
    [![npm](https://img.shields.io/npm/v/@taste-engine/adapters)](https://www.npmjs.com/package/@taste-engine/adapters)
    [![CI](https://github.com/YOUR_ORG/taste-engine/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/taste-engine/actions/workflows/ci.yml)
    ```

    Notes:
    - Replace `YOUR_ORG/taste-engine` with the actual GitHub repo path once known — leave the placeholder for now
    - The Installation section must come BEFORE "## Key Features" to follow the standard README convention (badges → one-liner → install → features)
    - Do NOT rewrite or restructure any other sections of README.md
  </action>
  <verify>Select-String -Path "README.md" -Pattern "npm install @taste-engine/core"</verify>
  <done>README.md contains `npm install @taste-engine/core`; npm badges present after `# Taste Engine` heading</done>
</task>

## Success Criteria
- [ ] `CONTRIBUTING.md` exists at workspace root
- [ ] CONTRIBUTING.md documents `npx changeset` workflow end-to-end
- [ ] CONTRIBUTING.md documents both `NPM_TOKEN` and `FLY_API_TOKEN` secrets
- [ ] Root `README.md` has npm install instructions for both packages
- [ ] Root `README.md` has npm version + CI badges
