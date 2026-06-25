/** Circuit-breaker finite states. */
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ClassifierCircuitBreakerOptions {
  /** Consecutive failures needed to open the breaker. Default: 3. */
  failureThreshold?: number;
  /** How long OPEN lasts before probing again. Default: 5 minutes. */
  resetTimeoutMs?: number;
  /** Injected clock for deterministic tests. */
  now?: () => number;
  /** Callback triggered exactly when breaker transitions to OPEN. */
  onOpen?: () => void;
}

/**
 * Classifier circuit breaker (doc section 9).
 *
 * When OPEN, the system should skip classifier calls and run L0-only, returning
 * PARSE_ERROR for non-L0-blocked inputs (fail-closed by design).
 */
export class ClassifierCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly now: () => number;
  private readonly onOpen?: () => void;

  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenProbeGranted = false;

  constructor(options?: ClassifierCircuitBreakerOptions) {
    this.failureThreshold = options?.failureThreshold ?? 3;
    this.resetTimeoutMs = options?.resetTimeoutMs ?? 5 * 60 * 1000;
    this.now = options?.now ?? Date.now;
    this.onOpen = options?.onOpen;
  }

  /** Current state (OPEN can auto-transition to HALF_OPEN after timeout). */
  getState(): CircuitState {
    this.transitionOpenToHalfOpenIfDue();
    return this.state;
  }

  /** True only while breaker is actively OPEN. */
  isOpen(): boolean {
    return this.getState() === "OPEN";
  }

  /**
   * Whether a classifier call may be attempted now.
   * - CLOSED: always yes.
   * - OPEN: no, until reset timeout elapses.
   * - HALF_OPEN: allow a single probe call; further attempts blocked until
   *   recordSuccess/recordFailure resolves the state.
   */
  canAttempt(): boolean {
    this.transitionOpenToHalfOpenIfDue();

    if (this.state === "CLOSED") {
      return true;
    }

    if (this.state === "OPEN") {
      return false;
    }

    if (this.halfOpenProbeGranted) {
      return false;
    }

    this.halfOpenProbeGranted = true;
    return true;
  }

  /** Record a classifier failure. May open/re-open the breaker. */
  recordFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.openBreaker();
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openBreaker();
    }
  }

  /** Record a classifier success. Closes breaker and resets counters. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.halfOpenProbeGranted = false;
  }

  private transitionOpenToHalfOpenIfDue(): void {
    if (this.state !== "OPEN") {
      return;
    }

    if (this.now() - this.openedAt < this.resetTimeoutMs) {
      return;
    }

    this.state = "HALF_OPEN";
    this.halfOpenProbeGranted = false;
  }

  private openBreaker(): void {
    this.state = "OPEN";
    this.openedAt = this.now();
    this.consecutiveFailures = this.failureThreshold;
    this.halfOpenProbeGranted = false;
    this.onOpen?.();
  }
}
