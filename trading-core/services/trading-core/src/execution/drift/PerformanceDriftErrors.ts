export class PerformanceDriftError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'PerformanceDriftError';
  }
}

export class PerformanceRevisionMismatchError extends PerformanceDriftError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PERFORMANCE_REVISION_MISMATCH', details);
    this.name = 'PerformanceRevisionMismatchError';
  }
}

export class PerformanceEnvironmentMismatchError extends PerformanceDriftError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PERFORMANCE_ENVIRONMENT_MISMATCH', details);
    this.name = 'PerformanceEnvironmentMismatchError';
  }
}

export class PerformanceInsufficientDataError extends PerformanceDriftError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PERFORMANCE_INSUFFICIENT_DATA', details);
    this.name = 'PerformanceInsufficientDataError';
  }
}

export class PerformanceIdempotencyConflictError extends PerformanceDriftError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PERFORMANCE_IDEMPOTENCY_CONFLICT', details);
    this.name = 'PerformanceIdempotencyConflictError';
  }
}

export class RevalidationRequestConflictError extends PerformanceDriftError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'REVALIDATION_REQUEST_CONFLICT', details);
    this.name = 'RevalidationRequestConflictError';
  }
}
