import type { ExecutionFill, TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { StateMutationError } from './StateErrors.js';
import { assertTenantExecutionContext, contextFromEvent, readString, toRecord } from './StateContext.js';
import type { ExecutionState } from './StateTypes.js';

export class ExecutionStateService {
  private readonly executions = new Map<string, ExecutionState>();

  applyEvent(event: TradingEvent): ExecutionState | undefined {
    if (!isExecutionStateEvent(event.type)) {
      return undefined;
    }

    const context = contextFromEvent(event);
    assertTenantExecutionContext(context);

    const payload = toRecord(event.payload);
    const current = this.executions.get(event.correlationId);
    const next: ExecutionState = {
      correlationId: event.correlationId,
      status: current?.status ?? 'requested',
      updatedAt: event.occurredAt,
      requestId: current?.requestId,
      providerId: context.providerId ?? current?.providerId,
      providerOrderId: current?.providerOrderId,
      market: current?.market,
      userId: context.userId ?? current?.userId,
      daoId: context.daoId ?? current?.daoId,
      runtimeInstanceId: context.runtimeInstanceId ?? current?.runtimeInstanceId,
      strategyId: context.strategyId ?? current?.strategyId,
      strategyProductId: context.strategyProductId ?? current?.strategyProductId,
      fills: [...(current?.fills ?? [])],
      failureReason: current?.failureReason,
    };

    if (event.type === 'EXECUTION_REQUESTED') {
      next.status = 'requested';
      next.requestId = readString(payload.requestId) ?? next.requestId;
      next.market = readString(payload.market) ?? next.market;
    } else if (event.type === 'ORDER_SUBMITTED') {
      const result = toRecord(payload.result);
      next.status = 'submitted';
      next.requestId = readString(result.requestId) ?? readString(payload.requestId) ?? next.requestId;
      next.providerOrderId = readString(result.providerOrderId) ?? readString(payload.providerOrderId) ?? next.providerOrderId;
      next.market = readString(payload.market) ?? next.market;
    } else if (event.type === 'ORDER_FILLED') {
      next.status = 'filled';
      const fill = payload.fill as ExecutionFill | undefined;
      if (fill) {
        next.fills.push(fill);
        next.providerOrderId = fill.providerOrderId;
        next.market = fill.market;
      }
    } else if (event.type === 'ORDER_CANCELLED') {
      next.status = 'cancelled';
      next.providerOrderId = readString(payload.providerOrderId) ?? next.providerOrderId;
    } else if (event.type === 'EXECUTION_FAILED') {
      next.status = 'failed';
      next.failureReason = readString(payload.reason) ?? 'execution failed';
    }

    this.executions.set(event.correlationId, next);
    return next;
  }

  getByCorrelationId(correlationId: string): ExecutionState | undefined {
    return this.executions.get(correlationId);
  }

  list(): ExecutionState[] {
    return [...this.executions.values()];
  }
}

function isExecutionStateEvent(type: TradingEvent['type']): boolean {
  return [
    'EXECUTION_REQUESTED',
    'ORDER_SUBMITTED',
    'ORDER_FILLED',
    'ORDER_CANCELLED',
    'EXECUTION_FAILED',
  ].includes(type);
}

export function assertExecutionStateEvent(event: TradingEvent): void {
  if (!isExecutionStateEvent(event.type)) {
    throw new StateMutationError(`Unsupported execution state event: ${event.type}`, 'UNSUPPORTED_STATE_EVENT');
  }
}
