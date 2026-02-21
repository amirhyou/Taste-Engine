import inquirer from 'inquirer';
import { Engine } from '@taste-engine/core';

const ITEMS = [
  'Chocolate Pizza',
  'Pineapple Tacos',
  'Durian Milkshake',
  'Vegemite Sushi',
  'Ketchup Ice Cream',
  'Garlic Brownies',
  'Mustard Donuts',
  'Onion Candy'
];

async function main() {
  console.clear();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' GSD ► TASTE ENGINE CLI ADVANCED DEMO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { k } = await inquirer.prompt([
    {
      type: 'number',
      name: 'k',
      message: 'Enter the number of Top Items to identify (K):',
      default: 3,
      validate: (val) => (val > 0 && val <= ITEMS.length) || 'Must be between 1 and total items'
    }
  ]);

  const engine = new Engine({
    k,
    cycleGuard: { enabled: true, alarmThreshold: 0.1 }
  });

  engine.addItems(ITEMS);

  while (true) {
    const status = engine.status();

    console.log('\n--- Current Stats ---');
    console.log(`Target K: ${k} | Stability: ${(status.stability * 100).toFixed(1)}% | ${status.canStop ? '✅ Ready' : '⚖️  Learning'}`);

    if (status.cycles.length > 0) {
      console.log(`⚠️  Cycles: ${status.cycles.map(c => c.join(' > ')).join(', ')}`);
    }

    // Show full ranking
    console.log('\nFull Rankings (Estimated Mu ± Sigma):');
    // Note: topKSet is already sorted by Mu. For full list we access engine internal or sort ourselves
    // Using a trick: set engine K temporarily to total to get full sorted list
    const originalK = engine.nextPair() ? k : k; // placeholder to keep logic flow
    const fullSortedItems = status.topKSet; // In this version topKSet is just the first K.

    // Let's just list all items sorted by their current performance
    const allItems = [...ITEMS].sort((a, b) => {
      // We don't have direct access to mu here via public API in a clean way without engine.status()
      // But status.topKSet is sorted. Let's just use the internal states via a trick if needed
      // or just show the top K and the rest alphabetically.
      return status.topKSet.indexOf(a) !== -1 ? -1 : 1;
    });

    status.topKSet.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.padEnd(20)} [Ranked Top ${k}]`);
    });

    const next = engine.nextPair();
    if (!next) {
      console.log('No more pairs recommended.');
      break;
    }

    const { choice } = await inquirer.prompt([
      {
        type: 'list',
        name: 'choice',
        message: 'Which is better?',
        choices: [
          { name: `[A] ${next.a}`, value: 'a' },
          { name: `[B] ${next.b}`, value: 'b' },
          { name: 'Tie', value: 'tie' },
          { name: 'Skip', value: 'skip' },
          new inquirer.Separator(),
          { name: 'Exit', value: 'exit' }
        ]
      }
    ]);

    if (choice === 'exit') break;

    engine.ingest({
      a: next.a,
      b: next.b,
      result: choice,
      t: Date.now()
    });

    console.clear();
  }

  console.log('\nFinal Decision:');
  const finalStatus = engine.status();
  finalStatus.topKSet.forEach((item, i) => console.log(`${i + 1}. ${item}`));
  console.log('\nGoodbye!');
}

main().catch(console.error);
