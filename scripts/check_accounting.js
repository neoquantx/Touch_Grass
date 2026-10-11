const { planSpend } = require('../src/llm/accounting.js');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
}

// balance 0 at start
let res = planSpend({ generated: 1, alreadySpent: 0, balance: 0, chunk: 20 });
assert(res.spendNow === 0 && res.stop === true, 'balance 0 at start should stop immediately');

// chunk of 20
res = planSpend({ generated: 25, alreadySpent: 0, balance: 100, chunk: 20 });
assert(res.spendNow === 20 && res.stop === false, 'should spend 20 when pending >= 20');

// balance runs out mid-stream
res = planSpend({ generated: 20, alreadySpent: 0, balance: 15, chunk: 20 });
assert(res.spendNow === 15 && res.stop === true, 'should spend remaining balance and stop');

// exact boundary
res = planSpend({ generated: 20, alreadySpent: 0, balance: 20, chunk: 20 });
assert(res.spendNow === 20 && res.stop === true, 'should spend 20 and stop when exact boundary');

// final flush
res = planSpend({ generated: 15, alreadySpent: 0, balance: 100, chunk: 'flush' });
assert(res.spendNow === 15 && res.stop === false, 'flush should spend all pending');

console.log('check_accounting.js PASSED');
