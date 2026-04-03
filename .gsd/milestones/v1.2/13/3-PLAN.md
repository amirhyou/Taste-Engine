---
phase: 13
plan: 3
wave: 2
---

# Plan 13.3: Social Server Fly.io Deployment

## Objective
Make the social server deployable to Fly.io with a single command. Add `fly.toml` to `examples/social-server/` and extend the Release workflow to auto-deploy on push to `main` when social-server files change.

## Context
- .gsd/SPEC.md
- .gsd/phases/13/RESEARCH.md
- .gsd/ARCHITECTURE.md
- examples/social-server/Dockerfile
- examples/social-server/package.json
- .github/workflows/release.yml (created in Plan 13.1)

## Tasks

<task type="auto">
  <name>Create examples/social-server/fly.toml</name>
  <files>examples/social-server/fly.toml</files>
  <action>
    Create `examples/social-server/fly.toml` with the following content. The app name `taste-engine-social` is a placeholder — the actual Fly.io app name must be set by the repo owner when they run `fly launch` or `fly apps create`.

    ```toml
    # Fly.io deployment config for taste-engine social-server
    # Build context is the monorepo root (required for workspace deps)
    # Deploy: fly deploy --config examples/social-server/fly.toml

    app = "taste-engine-social"
    primary_region = "syd"

    [build]
      dockerfile = "examples/social-server/Dockerfile"
      # Build context must be monorepo root — set via fly deploy --dockerfile flag
      # or by running fly deploy from the repo root

    [http_service]
      internal_port = 3001
      force_https = true
      auto_stop_machines = "stop"
      auto_start_machines = true
      min_machines_running = 0

      [[http_service.checks]]
        grace_period = "10s"
        interval = "30s"
        method = "GET"
        timeout = "5s"
        path = "/health"

    [env]
      NODE_ENV = "production"
      PORT = "3001"

    # Redis: attach via `fly redis attach <redis-name>` — injects REDIS_URL automatically
    # Do NOT hardcode credentials here; use fly secrets set REDIS_URL=...
    ```

    Notes:
    - `primary_region = "syd"` (Sydney) — closest to Auckland; change if needed
    - `auto_stop_machines = "stop"` + `min_machines_running = 0` = scale-to-zero on free tier
    - Redis URL is injected via `fly secrets set REDIS_URL=...` — never committed to repo
    - The `[build]` section references the Dockerfile path relative to where the `fly deploy` command is run (monorepo root)
    - The `/health` check path must exist in `examples/social-server/src/api/` — verify before deploying
  </action>
  <verify>Test-Path "examples/social-server/fly.toml"</verify>
  <done>File exists; `app = "taste-engine-social"` present; `dockerfile = "examples/social-server/Dockerfile"` present; `/health` path referenced in checks</done>
</task>

<task type="auto">
  <name>Add fly deploy job to .github/workflows/release.yml</name>
  <files>.github/workflows/release.yml</files>
  <action>
    Append a second job `deploy-social-server` to `.github/workflows/release.yml`. This job runs AFTER the `release` job completes and only when files under `examples/social-server/` or packages change.

    Add the following to the end of `.github/workflows/release.yml`, after the closing `---` of the `release` job:

    ```yaml
      deploy-social-server:
        runs-on: ubuntu-latest
        needs: release
        if: |
          github.ref == 'refs/heads/main' &&
          (
            contains(github.event.commits[*].modified, 'examples/social-server/') ||
            contains(github.event.commits[*].added, 'examples/social-server/')
          )
        steps:
          - uses: actions/checkout@v4
          - uses: superfly/flyctl-actions/setup-flyctl@master
          - run: fly deploy --config examples/social-server/fly.toml --dockerfile examples/social-server/Dockerfile
            env:
              FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
    ```

    Notes:
    - `needs: release` ensures publish always runs before deploy
    - `FLY_API_TOKEN` must be added as a GitHub Actions secret by the repo owner (obtained via `fly tokens create deploy`)
    - `--dockerfile examples/social-server/Dockerfile` — Fly deploy must be run from monorepo root so the Docker build context includes `packages/core`
    - The `if:` condition is heuristic — `contains(github.event.commits[*].modified, ...)` matches partial paths; this is acceptable for CI
    - Do NOT add `fly.toml` to `.gitignore` — it must be committed
  </action>
  <verify>Select-String -Path ".github/workflows/release.yml" -Pattern "deploy-social-server"</verify>
  <done>`deploy-social-server` job present in release.yml; `FLY_API_TOKEN` referenced; `needs: release` present</done>
</task>

## Success Criteria
- [ ] `examples/social-server/fly.toml` exists with valid TOML structure
- [ ] `.github/workflows/release.yml` has a `deploy-social-server` job that `needs: release`
- [ ] `FLY_API_TOKEN` secret is documented (in CONTRIBUTING.md — Plan 13.4)
- [ ] `/health` endpoint existence verified in social-server source
