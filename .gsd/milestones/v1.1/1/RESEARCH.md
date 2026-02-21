---
phase: 1
level: 2
researched_at: 2026-02-19
---

# Phase 1 Research

## Questions Investigated
1. **TrueSkill-like Implementation**: What is the most efficient and robust way to implement a TrueSkill-like normal approximation for pairwise comparisons in TypeScript? Is there a library we can adapt or should we build from scratch?
2. **Standard Normal Distribution Functions**: Which library or implementation should we use for `cdf`, `pdf`, and `ppf` (inverse cdf) functions needed for the math?
3. **Random Number Generation**: Do we need a seeded RNG for deterministic testing? If so, which one?

## Findings

### TrueSkill-like Implementation
**Options Verified:**
- `ts-trueskill`: Direct port of Python TrueSkill. **Issue**: "TrueSkill" is a Microsoft trademark/patent. While often ignored, strictly speaking, it's risky for a "general purpose library" to use the name or exact algorithm if aiming for wide open-source adoption.
- `openskill.js`: MIT licensed, supports Weng-Lin, Plackett-Luce, Bradley-Terry. Very fast. **Issue**: It's an external dependency.
- **Custom Implementation**: The core logic for 2-player Gaussian updates (Thurstone-Mosteller case) is relatively simple (~50 LOC).

**Recommendation**: Implement a custom "Gaussian Rating" engine.
- Use the standard update formulas (moment matching).
- Avoid the "TrueSkill" name; call it "GaussianFactor" or "NormalRating".
- This aligns with the "Zero dependencies" goal.

### Standard Normal Functions (CDF, PDF, PPF)
To implement the rating updates, we need:
- `pdf(x)`: Simple formula.
- `cdf(x)`: Requires `erf(x)`.
- `ppf(x)`: Requires `erfinv(x)`.

**Findings**:
- No standard JS/TS `Math.erf` exists.
- `math.js` is too heavy (hundreds of functions).
- `simple-statistics` is lighter but might still be overkill.
- **Approximations**: Standard numerical recipes (e.g., Abramowitz & Stegun 7.1.26 for erf, Acklam's algorithm for erfinv) are available in the public domain.

**Recommendation**: Internalize `erf`, `erfinv`, `pdf`, `cdf`, `ppf` in `src/utils/statistics.ts`.
- Use high-precision approximations.
- Verify against a "ground truth" (e.g., generated values from Python `scipy.stats`) in unit tests.

### Random Number Generation (RNG)
The engine must be **deterministic**. `Math.random()` is not seedable standards-compliant.

**Options**:
- `seedrandom`: Common, but external dep.
- `prando`: Nice API, external dep.
- **Custom LCG/PCG**: A simple generator like Mulberry32 or PCG32 is <50 lines of code.

**Recommendation**: Implement `src/utils/rng.ts` with **Mulberry32**.
- Fast, simple, 32-bit state.
- Sufficient for "game" applications and sampling.
- Keeps "Zero dependencies".

## Decisions Made
| Decision           | Choice                  | Rationale                                                                                        |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------ |
| **Core Algorithm** | Custom Gaussian Updates | Avoid generic "TrueSkill" IP issues; keep core minimal and dependency-free.                      |
| **Math Functions** | Internal implementation | Avoid heavy deps like `math.js` for just 5 functions. Use standard approximations.               |
| **RNG**            | Custom Mulberry32       | `Math.random()` isn't seedable; external libs violate "zero-dep" preference for small utilities. |

## Patterns to Follow
- **Stateless/Pure Functions**: Math helpers should be pure.
- **Seeded Classes**: The `Engine` and `Confidence` modules must accept a seed or RNG instance.

## Risks
- **Numerical Stability**: Floating point errors in `erfinv` can be tricky at tails.
    - *Mitigation*: Clamp inputs to generic epsilon bounds (e.g., +/- 8 sigma) to avoid Infinity.
- **Algorithm Correctness**: Implementing stats from scratch is error-prone.
    - *Mitigation*: Generate a `verification_vectors.json` using Python/Scipy and test the TS implementation against it.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified (Zero!)
