export class EconomicFeedbackError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code = 'ECONOMIC_FEEDBACK_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

export class ExecutionDiagnosticInvariantError extends EconomicFeedbackError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'EXECUTION_DIAGNOSTIC_INVARIANT_VIOLATION', details);
  }
}

export class PnLAttributionError extends EconomicFeedbackError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PNL_ATTRIBUTION_ERROR', details);
  }
}

export class EconomicIdempotencyConflictError extends EconomicFeedbackError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'ECONOMIC_IDEMPOTENCY_CONFLICT', details);
  }
}

