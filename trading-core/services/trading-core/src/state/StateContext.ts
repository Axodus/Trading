import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { StateMutationError } from './StateErrors.js';
import type { StateMutationContext } from './StateTypes.js';

export function contextFromEvent(event: TradingEvent): StateMutationContext {
  const payload = toRecord(event.payload);
  const provider = toRecord(payload.provider);
  return {
    correlationId: event.correlationId,
    executionDomain: payload.executionDomain as StateMutationContext['executionDomain'],
    daoId: event.daoId,
    federationId: event.federationId,
    userId: event.userId,
    providerId: readString(payload.providerId) ?? readString(provider.providerId),
    strategyId: event.strategyId,
    strategyProductId: event.strategyProductId,
    runtimeInstanceId: event.runtimeInstanceId,
  };
}

export function assertMutationContext(context: StateMutationContext): void {
  if (!context.correlationId) {
    throw new StateMutationError('State mutation requires a correlationId.', 'MISSING_CORRELATION_ID');
  }
  if (!context.userId && !context.daoId && !context.runtimeInstanceId && !context.providerId) {
    throw new StateMutationError('State mutation requires tenant, runtime, or provider context.', 'MISSING_TENANT_CONTEXT');
  }
}

export function assertTenantExecutionContext(context: StateMutationContext): void {
  if (!context.correlationId) {
    throw new StateMutationError('State mutation requires a correlationId.', 'MISSING_CORRELATION_ID');
  }
  if (!context.userId && !context.daoId && !context.runtimeInstanceId) {
    throw new StateMutationError('State mutation requires user, DAO, or runtime tenant context.', 'MISSING_TENANT_CONTEXT');
  }
}

export function assertRuntimeContext(context: StateMutationContext): asserts context is StateMutationContext & { runtimeInstanceId: string } {
  assertTenantExecutionContext(context);
  if (!context.runtimeInstanceId) {
    throw new StateMutationError('Runtime state mutation requires runtimeInstanceId.', 'MISSING_RUNTIME_CONTEXT');
  }
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
