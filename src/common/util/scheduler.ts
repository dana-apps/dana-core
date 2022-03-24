// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fn = () => any;

/**
 * Serializes asynchronous tasks, ensuring that they happen in FIFO order.
 */
export class Scheduler {
  queue: Fn[] = [];
  active = false;

  run<Val>(fn: () => Promise<Val>) {
    return new Promise<Val>((resolve, reject) => {
      this.queue.unshift(() => fn().then(resolve, reject));

      if (!this.active) {
        this.start();
      }
    });
  }

  private async start() {
    this.active = true;

    let fn;
    while ((fn = this.queue.pop())) {
      await fn();
    }

    this.active = false;
  }
}
