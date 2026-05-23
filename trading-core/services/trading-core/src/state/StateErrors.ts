export class StateMutationError extends Error {
  constructor(
    message: string,
    public readonly code: 'MISSING_CORRELATION_ID' | 'MISSING_TENANT_CONTEXT' | 'MISSING_RUNTIME_CONTEXT' | 'UNSUPPORTED_STATE_EVENT',
  ) {
    super(message);
    this.name = 'StateMutationError';
  }
}
