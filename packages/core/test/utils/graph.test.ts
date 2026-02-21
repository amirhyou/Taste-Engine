import { describe, expect, it } from 'vitest';
import { findSCCs } from '../../src/utils/graph.js';
import { ItemId } from '../../src/types.js';

describe('Graph Utils - Tarjan SCC', () => {
    it('identifies a simple 3-cycle', () => {
        // A -> B -> C -> A
        const graph = new Map<ItemId, ItemId[]>();
        graph.set('A', ['B']);
        graph.set('B', ['C']);
        graph.set('C', ['A']);

        // Add some disconnected nodes
        graph.set('D', ['E']);
        graph.set('E', []);

        const sccs = findSCCs(graph);

        // Should find [C, B, A] (or any order)
        const cycle = sccs.find(c => c.length > 1);
        expect(cycle).toBeDefined();
        expect(cycle).toContain('A');
        expect(cycle).toContain('B');
        expect(cycle).toContain('C');
        expect(cycle?.length).toBe(3);

        // D and E are trivial SCCs
        expect(sccs.filter(c => c.length === 1)).toHaveLength(2);
    });

    it('identifies disjoint cycles', () => {
        // A->B->A and C->D->C
        const graph = new Map<ItemId, ItemId[]>();
        graph.set('A', ['B']);
        graph.set('B', ['A']);
        graph.set('C', ['D']);
        graph.set('D', ['C']);

        const sccs = findSCCs(graph);
        const cycles = sccs.filter(c => c.length > 1);
        expect(cycles).toHaveLength(2);
    });

    it('handles empty graph', () => {
        const graph = new Map<ItemId, ItemId[]>();
        const sccs = findSCCs(graph);
        expect(sccs).toHaveLength(0);
    });

    it('identifies complex tangled cycles', () => {
        // A->B->C->A, but also B->D->C
        // A, B, C, D are all in one component because D->C->A->B->D
        const graph = new Map<ItemId, ItemId[]>();
        graph.set('A', ['B']);
        graph.set('B', ['C', 'D']);
        graph.set('C', ['A']);
        graph.set('D', ['C']);

        const sccs = findSCCs(graph);
        const cycle = sccs.find(c => c.length > 1);
        expect(cycle?.length).toBe(4); // A, B, C, D
    });
});
