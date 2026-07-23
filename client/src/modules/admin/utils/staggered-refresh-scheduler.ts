/**
 * Staggered Refresh Scheduler to offset API calls during batch auto-refreshes
 * preventing backend request spikes (thundering herd problem).
 */
export function getStaggeredDelay(widgetId: string, baseOffsetMs: number = 0): number {
  const hash = Array.from(widgetId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const jitter = (hash % 5) * 50; // 0..200ms jitter
  return baseOffsetMs + jitter;
}

export function executeWithStagger<T>(fn: () => Promise<T>, delayMs: number): Promise<T> {
  if (delayMs <= 0) return fn();
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      fn().then(resolve).catch(reject);
    }, delayMs);
  });
}
