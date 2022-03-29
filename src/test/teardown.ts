type Cleanup = () => Promise<void>;
let cleanup: Cleanup[] = [];

afterEach(async () => {
  for (const fn of cleanup) {
    await fn();
  }

  cleanup = [];
});

/**
 * Utility for registering test cleanup blocks when setting up test fixtures.
 * @param fn Cleanup block to call after test completes.
 */
export function onCleanup(fn: Cleanup) {
  cleanup.push(fn);
}
