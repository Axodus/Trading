export class ShadowDecisionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'ShadowDecisionError';
  }
}

export class ShadowDecisionConflictError extends ShadowDecisionError {
  constructor(message: string) { super(message, 'SHADOW_IDEMPOTENCY_CONFLICT'); }
}

export class ShadowProviderResponseError extends ShadowDecisionError {
  constructor(message: string) { super(message, 'SHADOW_PROVIDER_RESPONSE_INVALID'); }
}
