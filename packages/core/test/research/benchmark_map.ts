
const startMem = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Start Memory: ${startMem.toFixed(2)} MB`);

const n = 5000;
const map = new Map<string, number>();

console.log(`Simulating fully connected graph for N=${n}...`);

let count = 0;
const logAt = 1000000;

try {
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            // Generating unique keys for all pairs
            const key = `${i}::${j}`;
            map.set(key, 1);
            count++;

            if (count % logAt === 0) {
                const currentMem = process.memoryUsage().heapUsed / 1024 / 1024;
                console.log(`${(count / 1000000).toFixed(1)}M pairs: ${currentMem.toFixed(2)} MB (+${(currentMem - startMem).toFixed(2)} MB)`);

                // Safety break if we explode
                if (currentMem > 2000) {
                    throw new Error("Memory limit approached 2GB");
                }
            }
        }
    }
} catch (e) {
    console.log('Stopped early:', e.message);
}

const finalMem = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Final Pairs: ${count}`);
console.log(`Final Memory: ${finalMem.toFixed(2)} MB`);
console.log(`Bytes per Pair: ${((finalMem - startMem) * 1024 * 1024 / count).toFixed(2)} bytes`);
