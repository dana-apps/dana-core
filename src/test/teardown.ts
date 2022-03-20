type Cleanup = () => Promise<void>;
let cleanup: Cleanup[] = [];

afterEach(async () => {
  for (const fn of cleanup) {
    await fn();
  }

  cleanup = [];
});

export function onCleanup(fn: Cleanup) {
  cleanup.push(fn);
}
