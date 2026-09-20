export class StrategyLifecycleError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "StrategyLifecycleError";
  }
}

export class StrategyLifecycleConcurrencyError extends StrategyLifecycleError {
  constructor(message: string) {
    super(message, "EXPECTED_HEAD_MISMATCH");
    this.name = "StrategyLifecycleConcurrencyError";
  }
}

export class StrategyLifecyclePolicyError extends StrategyLifecycleError {
  constructor(message: string) {
    super(message, "POLICY_UNAVAILABLE");
    this.name = "StrategyLifecyclePolicyError";
  }
}

export class StrategyLifecycleIdempotencyError extends StrategyLifecycleError {
  constructor(message: string) {
    super(message, "IDEMPOTENCY_CONFLICT");
    this.name = "StrategyLifecycleIdempotencyError";
  }
}
