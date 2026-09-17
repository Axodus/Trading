import type { ExecutionRequest, ExecutionResult } from './types.js';

export type AxodusExecutionOperation = 'execute-order' | 'cancel-order' | 'get-balances' | 'get-positions';

export type AxodusExecutionFailureCode =
  | 'AUTHORIZATION_REQUIRED'
  | 'INVALID_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_PROTOCOL_ERROR'
  | 'PROVIDER_UNKNOWN_ERROR';

export interface AxodusExecutionAuthorization {
  authorizationId: string;
  policyVersion: string;
  approvedAt: string;
  expiresAt?: string;
}

export interface AxodusExecutionRequest extends ExecutionRequest {
  intentId: string;
  correlationId: string;
  authorization: AxodusExecutionAuthorization;
}

export interface AxodusExecutionFailure {
  code: AxodusExecutionFailureCode;
  operation: AxodusExecutionOperation;
  message: string;
  retryable: boolean;
  upstreamStatus?: number;
  upstreamCode?: string;
}

export class ExecutionProviderBoundaryError extends Error {
  constructor(public readonly failure: AxodusExecutionFailure) {
    super(failure.message);
    this.name = 'ExecutionProviderBoundaryError';
  }
}

export interface AxodusExecutionProvider {
  executeOrder(request: AxodusExecutionRequest): Promise<ExecutionResult>;
}
