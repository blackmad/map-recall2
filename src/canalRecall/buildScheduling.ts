/** Share a short main-thread budget between staged road setup builders. */
export type BuildScheduling = {
  cancelled?: () => boolean;
  yieldToBrowser?: () => Promise<void>;
  budgetMs?: number;
};

export async function finishBatchedBuild<T>(stages: Generator<void, T>, scheduling: BuildScheduling = {}): Promise<T> {
  const yieldToBrowser = scheduling.yieldToBrowser ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  while (true) {
    const started = performance.now();
    do {
      if (scheduling.cancelled?.()) throw new DOMException('Route loading cancelled', 'AbortError');
      const step = stages.next();
      if (step.done) return step.value;
    } while (performance.now() - started < (scheduling.budgetMs ?? 8));
    await yieldToBrowser();
  }
}
