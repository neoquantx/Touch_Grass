export function planSpend({ generated, alreadySpent, balance, chunk }) {
  const pending = generated - alreadySpent;
  if (pending < 0) return { spendNow: 0, stop: true }; // Should not happen

  let spendNow = 0;
  if (pending >= chunk) {
    spendNow = chunk;
  } else if (generated === -1 || chunk === 'flush') { // Final flush
    spendNow = pending;
  }

  const stop = (balance - spendNow) <= 0;
  
  if (spendNow > balance) {
    spendNow = balance;
  }

  return { spendNow, stop };
}
