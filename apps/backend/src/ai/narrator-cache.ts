import type { NarratorResult } from "./narrator-types.js";

/**
 * LRU cache for narrator results.
 *
 * Cache key: "<campaignId>:<action>" (lowercased, trimmed).
 * We cache the full NarratorResult so a cache hit also replicates the
 * provider and guardrail metadata, but always sets `cached: true`.
 *
 * Eviction: least-recently-used when the cache exceeds `maxSize`.
 */
export class NarratorCache {
  // Map preserves insertion order; we move entries to the end on access (LRU).
  private readonly store: Map<string, NarratorResult>;
  private readonly maxSize: number;
  private readonly ttlMs: number;
  private readonly expiry: Map<string, number>;

  constructor(options: { maxSize?: number; ttlMs?: number } = {}) {
    this.maxSize = options.maxSize ?? 256;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.store = new Map();
    this.expiry = new Map();
  }

  static buildKey(campaignId: string, action: string): string {
    return `${campaignId.toLowerCase()}:${action.toLowerCase().trim()}`;
  }

  get(key: string): NarratorResult | undefined {
    const expiredAt = this.expiry.get(key);
    if (expiredAt !== undefined && Date.now() > expiredAt) {
      this.store.delete(key);
      this.expiry.delete(key);
      return undefined;
    }
    const value = this.store.get(key);
    if (value === undefined) return undefined;
    // Move to end to mark as recently used.
    this.store.delete(key);
    this.store.set(key, value);
    return { ...value, cached: true };
  }

  set(key: string, value: NarratorResult): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      // Evict the least-recently-used (first) entry.
      const lruKey = this.store.keys().next().value;
      if (lruKey !== undefined) {
        this.store.delete(lruKey);
        this.expiry.delete(lruKey);
      }
    }
    this.store.set(key, value);
    this.expiry.set(key, Date.now() + this.ttlMs);
  }

  get size(): number {
    return this.store.size;
  }
}
