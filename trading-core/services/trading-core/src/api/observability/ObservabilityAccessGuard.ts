import type { ObservabilityQueryContext } from '../../../../../packages/trading-contracts/src/index.js';

export class ObservabilityAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObservabilityAccessError';
  }
}

export class ObservabilityAccessGuard {
  assertTenantScope(context: ObservabilityQueryContext, resourceTenantId: string): void {
    if (!context.tenantId || context.tenantId !== resourceTenantId) {
      throw new ObservabilityAccessError('Observability query rejected: tenant scope mismatch.');
    }
  }

  assertRuntimeScope(context: ObservabilityQueryContext, runtimeInstanceId?: string): void {
    if (runtimeInstanceId && context.runtimeInstanceId && context.runtimeInstanceId !== runtimeInstanceId) {
      throw new ObservabilityAccessError('Observability query rejected: runtime scope mismatch.');
    }
  }
}
