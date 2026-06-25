export interface UserRateLimiterOptions {
  /** Max accepted requests inside the window (inclusive). */
  maxRequests: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Injected clock for deterministic tests. */
  now?: () => number;
}

/**
 * In-memory sliding-window rate limiter keyed by user id.
 *
 * ponytail: this single-instance implementation is enough for local/MVP use.
 * Upgrade path: replace storage with Redis to enforce global limits across
 * multiple backend instances.
 */
export class UserRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly hits = new Map<string, number[]>();

  constructor(options: UserRateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  /**
   * Consume one request slot for a user.
   * @returns true when accepted, false when limit exceeded.
   */
  tryConsume(userId: string): boolean {
    const t = this.now();
    const threshold = t - this.windowMs;
    const existing = this.hits.get(userId) ?? [];
    const live = existing.filter((ts) => ts > threshold);

    if (live.length >= this.maxRequests) {
      this.hits.set(userId, live);
      return false;
    }

    live.push(t);
    this.hits.set(userId, live);
    return true;
  }
}
