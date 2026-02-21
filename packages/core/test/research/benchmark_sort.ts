
const n = 5000;
const items = Array.from({ length: n }, (_, i) => ({
    id: `item_${i}`,
    mu: Math.random() * 50 + 25,
    sigma: Math.random() * 5 + 1
}));

console.log(`Sorting ${n} items...`);
const start = process.hrtime.bigint();

// Simulate typical sort in rankByMu
const sorted = items.sort((a, b) => b.mu - a.mu);

const end = process.hrtime.bigint();
const duration = Number(end - start) / 1e6; // ms

console.log(`Sort took ${duration.toFixed(3)} ms`);

if (duration > 10) {
    console.log("Warning: Sort is slow (>10ms)");
} else {
    console.log("Sort is fast enough.");
}
