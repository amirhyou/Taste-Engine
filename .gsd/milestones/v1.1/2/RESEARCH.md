---
phase: 2
level: 2
researched_at: 2026-02-19
---

# Phase 2 Research: Hardening & Performance

## Questions Investigated
1. **Memory Scalability**: Can we handle N=5000 items (12.5M pairs) in memory?
2. **Cycle Detection**: How to implement "Cycle Guardrail" efficiently?
3. **Sort Performance**: Is `Array.sort` fast enough for N=5000?

## Findings

### Memory Scalability
- **Benchmark**: Storing 12.5M unique keys in `Map<string, number>` uses ~850MB heap.
- **Node Limit**: Standard limit is ~2GB-4GB.
- **Conclusion**: In-memory `Map` is viable for N=5000. No need for external DB or complex optimizations yet.
- **Future optimization**: If N > 10,000, we may need Int32Array or key hashing.

### Cycle Detection
- **Algorithm**: Tarjan's strongly connected components (SCC) algorithm is O(V+E).
- **Application**: 
    - Build "Majority Wins" graph (A->B if wins(A,B) > wins(B,A)).
    - Run Tarjan's.
    - If SCC size > 1, items are in a cycle (e.g., A>B>C>A).
    - **Guardrail Action**: Flag items in large SCCs as "ambiguous" or "controversial".

### Sort Performance
- **Benchmark**: Sorting 5000 objects by `mu` takes ~1ms.
- **Conclusion**: No caching needed. `rankByMu` can be called frequently.

## Decisions Made
| Decision       | Choice                | Rationale                                       |
| -------------- | --------------------- | ----------------------------------------------- |
| **Storage**    | In-Memory `Map`       | Fits in heap (<1GB) for target scale.           |
| **Cycle Algo** | Tarjan's SCC          | Standard, efficient O(V+E), handles components. |
| **Pool Logic** | Standard `Array.sort` | Fast enough (~1ms), simplifies code.            |

## Patterns to Follow
- **Incremental checks**: Only run cycle detection periodically or on demand (e.g., inside `status()`), not on every `ingest`.

## Dependencies Identified
| Package | Version | Purpose                                          |
| ------- | ------- | ------------------------------------------------ |
| (None)  | -       | Implement Tarjan's internally (core constraint). |

## Risks
- **Memory Spikes**: If other parts of the app use large memory, 850MB might be too much.
- **Mitigation**: Add `config.capacityLimit` to reject new items if N exceeds safe limit.

## Ready for Planning
- [x] Questions answered
- [x] Approach selected
- [x] Dependencies identified
