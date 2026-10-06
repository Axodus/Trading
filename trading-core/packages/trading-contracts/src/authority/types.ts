/**
 * AXODUS-TRADING-IMP-EXECUTION-AUTHORITY-CONTEXT-01
 * Canonical Execution Authority Context
 */

export interface ExecutionAuthorityContext {
  readonly executionIntentId: string;
  /**
   * Canonical Core TenantId wire representation. The nominal Core package is
   * consumed at composition time; Trading must not create a second tenant root.
   */
  readonly tenantId: string;
  readonly principalRef: string;
  readonly action: string;
  readonly resource: string;
  readonly governanceAuthorityRef?: string;
  /** Requested Treasury scope only; presence does not mean Treasury approval. */
  readonly treasuryScopeRef?: string;
  readonly treasuryAuthorizationRef?: string;
  readonly requestedAt: string;
}

export type ExecutionAuthorityContextErrorCode =
  | 'EXECUTION_AUTHORITY_CONTEXT_MISSING'
  | 'EXECUTION_TENANT_MISSING'
  | 'EXECUTION_PRINCIPAL_MISSING'
  | 'EXECUTION_ACTION_MISSING'
  | 'EXECUTION_RESOURCE_MISSING'
  | 'EXECUTION_REQUESTED_AT_INVALID'
  | 'EXECUTION_TENANT_MISMATCH'
  | 'EXECUTION_PRINCIPAL_MISMATCH'
  | 'EXECUTION_ACTION_MISMATCH'
  | 'EXECUTION_RESOURCE_MISMATCH';

export class ExecutionAuthorityContextError extends Error {
  constructor(
    message: string,
    public readonly code: ExecutionAuthorityContextErrorCode,
  ) {
    super(message);
    this.name = 'ExecutionAuthorityContextError';
  }
}

export interface ExecutionAuthorityContextValidationResult {
  readonly valid: boolean;
  readonly reasons: readonly string[];
  readonly code?: ExecutionAuthorityContextErrorCode;
}

export interface ExecutionAuthorityBinding {
  readonly executionIntentId: string;
  readonly tenantId: string;
  readonly principalRef: string;
  readonly action: string;
  readonly resource: string;
}

export const EXECUTION_ORDER_SUBMIT_ACTION = 'order.submit';

const ISO_DATE_TIME_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function executionOrderResource(providerId: string, market: string): string {
  return `execution-provider:${providerId}:market:${market}`;
}

export function validateExecutionAuthorityContext(
  context: unknown,
): ExecutionAuthorityContextValidationResult {
  if (!context || typeof context !== 'object') {
    return {
      valid: false,
      reasons: ['Execution authority context is missing or not an object.'],
      code: 'EXECUTION_AUTHORITY_CONTEXT_MISSING',
    };
  }

  const c = context as Partial<ExecutionAuthorityContext>;
  const reasons: string[] = [];
  let primaryCode: ExecutionAuthorityContextErrorCode | undefined;

  if (!c.executionIntentId || typeof c.executionIntentId !== 'string' || c.executionIntentId.trim() === '') {
    reasons.push('Execution intent id is required and must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_AUTHORITY_CONTEXT_MISSING';
  }

  if (!c.tenantId || typeof c.tenantId !== 'string' || c.tenantId.trim() === '') {
    reasons.push('Tenant id is required and must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_TENANT_MISSING';
  }

  if (!c.principalRef || typeof c.principalRef !== 'string' || c.principalRef.trim() === '') {
    reasons.push('Principal reference is required and must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_PRINCIPAL_MISSING';
  }

  if (!c.action || typeof c.action !== 'string' || c.action.trim() === '') {
    reasons.push('Action is required and must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_ACTION_MISSING';
  }

  if (!c.resource || typeof c.resource !== 'string' || c.resource.trim() === '') {
    reasons.push('Resource is required and must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_RESOURCE_MISSING';
  }

  if (
    !c.requestedAt
    || typeof c.requestedAt !== 'string'
    || !ISO_DATE_TIME_WITH_ZONE.test(c.requestedAt)
    || Number.isNaN(Date.parse(c.requestedAt))
  ) {
    reasons.push('RequestedAt must be a valid ISO-8601 date-time string.');
    if (!primaryCode) primaryCode = 'EXECUTION_REQUESTED_AT_INVALID';
  }

  if (
    c.governanceAuthorityRef !== undefined
    && (typeof c.governanceAuthorityRef !== 'string' || c.governanceAuthorityRef.trim() === '')
  ) {
    reasons.push('Governance authority reference if provided must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_AUTHORITY_CONTEXT_MISSING';
  }

  if (
    c.treasuryScopeRef !== undefined
    && (typeof c.treasuryScopeRef !== 'string' || c.treasuryScopeRef.trim() === '')
  ) {
    reasons.push('Treasury scope reference if provided must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_AUTHORITY_CONTEXT_MISSING';
  }

  if (
    c.treasuryAuthorizationRef !== undefined
    && (typeof c.treasuryAuthorizationRef !== 'string' || c.treasuryAuthorizationRef.trim() === '')
  ) {
    reasons.push('Treasury authorization reference if provided must be a non-empty string.');
    if (!primaryCode) primaryCode = 'EXECUTION_AUTHORITY_CONTEXT_MISSING';
  }

  return {
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons),
    code: primaryCode,
  };
}

export function validateExecutionAuthorityBinding(
  context: unknown,
  expected: ExecutionAuthorityBinding,
): ExecutionAuthorityContextValidationResult {
  const structuralValidation = validateExecutionAuthorityContext(context);
  if (!structuralValidation.valid) {
    return structuralValidation;
  }

  const authorityContext = context as ExecutionAuthorityContext;
  const mismatches: Array<{
    field: keyof ExecutionAuthorityBinding;
    code: ExecutionAuthorityContextErrorCode;
  }> = [
    { field: 'executionIntentId', code: 'EXECUTION_AUTHORITY_CONTEXT_MISSING' },
    { field: 'tenantId', code: 'EXECUTION_TENANT_MISMATCH' },
    { field: 'principalRef', code: 'EXECUTION_PRINCIPAL_MISMATCH' },
    { field: 'action', code: 'EXECUTION_ACTION_MISMATCH' },
    { field: 'resource', code: 'EXECUTION_RESOURCE_MISMATCH' },
  ];

  for (const mismatch of mismatches) {
    if (authorityContext[mismatch.field] !== expected[mismatch.field]) {
      return {
        valid: false,
        reasons: [`Execution authority ${mismatch.field} does not match the protected operation.`],
        code: mismatch.code,
      };
    }
  }

  return { valid: true, reasons: Object.freeze([]) };
}

export function createExecutionAuthorityContext(
  input: ExecutionAuthorityContext,
): ExecutionAuthorityContext {
  const validation = validateExecutionAuthorityContext(input);
  if (!validation.valid) {
    throw new ExecutionAuthorityContextError(
      validation.reasons.join('; '),
      validation.code ?? 'EXECUTION_AUTHORITY_CONTEXT_MISSING',
    );
  }

  return Object.freeze({
    executionIntentId: input.executionIntentId,
    tenantId: input.tenantId,
    principalRef: input.principalRef,
    action: input.action,
    resource: input.resource,
    governanceAuthorityRef: input.governanceAuthorityRef,
    treasuryScopeRef: input.treasuryScopeRef,
    treasuryAuthorizationRef: input.treasuryAuthorizationRef,
    requestedAt: input.requestedAt,
  });
}
