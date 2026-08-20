// Single-flight dedupe: concurrent requests sharing the same key wait on one
// in-flight promise, so repeated identical POSTs cannot each resubmit an
// expensive FortyGuard activity (observed as duplicate tcm submissions).
export type InFlightRegistry = {
  run<T>(key: string, work: () => Promise<T>): Promise<T>;
};

export function createInFlightRegistry(): InFlightRegistry {
  const pending = new Map<string, Promise<unknown>>();

  return {
    run<T>(key: string, work: () => Promise<T>): Promise<T> {
      const existing = pending.get(key);
      if (existing !== undefined) {
        return existing as Promise<T>;
      }
      const promise = work().finally(() => {
        pending.delete(key);
      });
      pending.set(key, promise);
      return promise;
    }
  };
}