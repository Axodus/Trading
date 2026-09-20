export class PreExecutionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'PreExecutionError';
  }
}

export class PreExecutionIdempotencyConflictError extends PreExecutionError {
  constructor(message: string) {
    super(message, 'IDEMPOTENCY_CONFLICT');
    this.name = 'PreExecutionIdempotencyConflictError';
  }
}

export class PreExecutionAuthorizationConsumedError extends PreExecutionError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ALREADY_CONSUMED');
    this.name = 'PreExecutionAuthorizationConsumedError';
  }
}

export class PreExecutionConcurrencyError extends PreExecutionError {
  constructor(message: string) {
    super(message, 'CONCURRENCY_ERROR');
    this.name = 'PreExecutionConcurrencyError';
  }
}
