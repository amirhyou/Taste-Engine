# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
A general-purpose **TypeScript** library for **top‑k identification from noisy human pairwise preferences**. It provides a pure, deterministic engine to rank items with confidence-based early stopping, fairness, and active pair selection, usable in Node, browser, and React Native.

## Goals
1. **Pure, Deterministic Core**: No DB, no UI, embeddable anywhere.
2. **Dual Modes**: Support both **Single-run** (static list) and **Incremental/streaming** (long-lived, online updates).
3. **Smart Defaults**: Strong defaults for policy knobs (pool sizes, boundary widths, decay).
4. **Product-Ready Status**: Output stability %, contested items, and next-pair recommendations.
5. **Scalable**: efficient for n up to 5,000+ with k=10–100 (avoid O(n²) work).

## Non-Goals (Out of Scope)
- Full "recommender system" (latent-factor personalization / multi-user embeddings).
- Heavy MCMC inference (prefer online approximations).
- Owning storage, auth, rate limiting, or moderation.
- UI components (for v1 Core).

## Users
- **Developers** building ranking interfaces, voting apps, or curation tools in TypeScript/JavaScript environments.

## Constraints
- **Runtime**: TypeScript / Node.js / Browser.
- **Dependencies**: Zero or minimal runtime dependencies for `@taste-engine/core`.
- **Performance**: `ingest()` O(1)–O(log n), `nextPair()` sub-O(n) (using pools).

## Success Criteria
- [ ] `@taste-engine/core` published and usable.
- [ ] 80%+ unit test coverage for core logic.
- [ ] Benchmarks confirming performance at n=5,000, k=50.
- [ ] Example apps (CLI and Minimal React UI) demonstrating functionality.
