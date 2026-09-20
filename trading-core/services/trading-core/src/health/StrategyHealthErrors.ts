export class StrategyHealthError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StrategyHealthError';
  }
}

export class StrategyHealthConcurrencyError extends StrategyHealthError {
  constructor(message: string) {
    super(message, 'EXPECTED_HEAD_MISMATCH');
    this.name = 'StrategyHealthConcurrencyError';
  }
}

export class StrategyHealthIdempotencyError extends StrategyHealthError {
  constructor(message: string) {
    super(message, 'IDEMPOTENCY_CONFLICT');
    this.name = 'StrategyHealthIdempotencyError';
  }
}
