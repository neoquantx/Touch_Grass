class AbortFlag {
  constructor() {
    this.aborted = false;
  }
  abort() {
    this.aborted = true;
  }
  check() {
    if (this.aborted) throw new Error('Aborted');
  }
}

let queuePromise = Promise.resolve();
let currentJobCancel = null;

export function runExclusive(fn) {
  const flag = new AbortFlag();
  
  const p = queuePromise.then(() => {
    currentJobCancel = flag;
    return fn(flag).finally(() => {
      if (currentJobCancel === flag) {
        currentJobCancel = null;
      }
    });
  });
  
  queuePromise = p.catch(() => {});
  return p;
}

export function cancelCurrentJob() {
  if (currentJobCancel) {
    currentJobCancel.abort();
    currentJobCancel = null;
  }
}
