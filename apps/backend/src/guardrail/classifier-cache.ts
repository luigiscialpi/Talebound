import type { ClassifierResult } from "@talebound/shared";

/** Default max entries for classifier cache (doc section 4). */
export const DEFAULT_CLASSIFIER_CACHE_MAX = 1000;

/** Default classifier cache TTL in milliseconds (5 minutes, doc section 4). */
export const DEFAULT_CLASSIFIER_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  value: ClassifierResult;
  expiresAt: number;
}

export interface ClassifierLRUCacheOptions {
  max?: number;
  ttlMs?: number;
  now?: () => number;
}

/**
 * Build a stable cache key for classifier results.
 *
 * The same input in the same campaign should map to the same key, independent
 * of case and surrounding spaces.
 */
export function getCacheKey(input: string, campaignId: string): string {
  return `${campaignId}:${input.toLowerCase().trim()}`;
}

/**
 * In-memory LRU + TTL cache for classifier results.
 *
 * ponytail: single-instance MVP keeps cache local (zero infra latency).
 * Upgrade path: keep the same interface and swap implementation with Redis for
 * multi-instance deployments.
 */
export class ClassifierLRUCache {
  private readonly max: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, CacheEntry>();

  constructor(options?: ClassifierLRUCacheOptions) {
    this.max = options?.max ?? DEFAULT_CLASSIFIER_CACHE_MAX;
    this.ttlMs = options?.ttlMs ?? DEFAULT_CLASSIFIER_CACHE_TTL_MS;
    this.now = options?.now ?? Date.now;
  }

  /** Return cached classification if present and not expired. */
  get(key: string): ClassifierResult | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }

    // Refresh recency on read (LRU behavior).
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Insert or overwrite a cached classification. */
  set(key: string, value: ClassifierResult): void {
    const entry: CacheEntry = {
      value,
      expiresAt: this.now() + this.ttlMs,
    };

    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, entry);

    // Evict least-recently-used entries if capacity is exceeded.
    while (this.entries.size > this.max) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }

  /** Drop all cache entries. */
  clear(): void {
    this.entries.clear();
  }

  /** Number of currently live entries (expired keys are purged first). */
  size(): number {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
    return this.entries.size;
  }
}
