type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * Dependency-free TTL cache (plain Map + timestamp check). This is a
 * hackathon-scope safeguard so repeated identical requests within a session
 * do not trigger duplicate FortyGuard/ORS calls — not a persistence layer.
 * Phase 2+ keys entries by request signature and wires this into endpoints.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}