export class ExecutionBoundaryError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ExecutionBoundaryError';
  }
}

export class ExecutionIdempotencyConflictError extends ExecutionBoundaryError {
  constructor(message: string) {
    super(message, 'IDEMPOTENCY_CONFLICT');
    this.name = 'ExecutionIdempotencyConflictError';
  }
}

export class TradingIntentAlreadyConsumedError extends ExecutionBoundaryError {
  constructor(message: string) {
    super(message, 'TRADING_INTENT_ALREADY_CONSUMED');
    this.name = 'TradingIntentAlreadyConsumedError';
  }
}

export class ExecutionHaltActiveError extends ExecutionBoundaryError {
  constructor(message: string) {
    super(message, 'EXECUTION_HALT_ACTIVE');
    this.name = 'ExecutionHaltActiveError';
  }
}

export class StaleExecutionIntentError extends ExecutionBoundaryError {
  constructor(message: string) {
    super(message, 'TRADING_INTENT_STALE');
    this.name = 'StaleExecutionIntentError';
  }
}
