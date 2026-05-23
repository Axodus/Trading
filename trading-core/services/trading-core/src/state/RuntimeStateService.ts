import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { assertRuntimeContext, contextFromEvent, readString, toRecord } from './StateContext.js';
import type { RuntimeState } from './StateTypes.js';

export class RuntimeStateService {
  private readonly runtimes = new Map<string, RuntimeState>();

  applyEvent(event: TradingEvent): RuntimeState | undefined {
    if (!isRuntimeStateEvent(event.type)) {
      return undefined;
    }

    const context = contextFromEvent(event);
    if (event.type === 'EMERGENCY_SHUTDOWN_TRIGGERED' && !context.runtimeInstanceId) {
      return undefined;
    }
    assertRuntimeContext(context);

    const current = this.runtimes.get(context.runtimeInstanceId);
    const payload = toRecord(event.payload);
    const next: RuntimeState = {
      runtimeInstanceId: context.runtimeInstanceId,
      status: current?.status ?? 'provisioning',
      updatedAt: event.occurredAt,
      userId: context.userId ?? current?.userId,
      providerId: context.providerId ?? current?.providerId,
      strategyProductId: context.strategyProductId ?? current?.strategyProductId,
      strategyId: context.strategyId ?? current?.strategyId,
      suspensionReason: current?.suspensionReason,
    };

    if (event.type === 'RUNTIME_PROVISION_REQUESTED') {
      next.status = 'requested';
    } else if (event.type === 'RUNTIME_PROVISION_APPROVED') {
      next.status = 'provisioning';
    } else if (event.type === 'USER_RUNTIME_PROVISIONED' || event.type === 'RUNTIME_STARTED') {
      next.status = 'active';
      next.suspensionReason = undefined;
    } else if (event.type === 'USER_RUNTIME_PAUSED' || event.type === 'RUNTIME_PAUSED') {
      next.status = 'paused';
    } else if (event.type === 'USER_RUNTIME_RESUMED') {
      next.status = 'active';
      next.suspensionReason = undefined;
    } else if (event.type === 'USER_RUNTIME_SUSPENDED') {
      next.status = 'suspended';
      next.suspensionReason = readString(payload.reason) ?? 'runtime suspended';
    } else if (event.type === 'RUNTIME_RECOVERING') {
      next.status = 'recovering';
    } else if (event.type === 'USER_RUNTIME_STOPPED' || event.type === 'RUNTIME_TERMINATED') {
      next.status = event.type === 'RUNTIME_TERMINATED' ? 'terminated' : 'stopped';
    } else if (event.type === 'EMERGENCY_SHUTDOWN_TRIGGERED') {
      next.status = 'suspended';
      next.suspensionReason = readString(payload.reason) ?? 'emergency shutdown';
    }

    this.runtimes.set(context.runtimeInstanceId, next);
    return next;
  }

  get(runtimeInstanceId: string): RuntimeState | undefined {
    return this.runtimes.get(runtimeInstanceId);
  }

  list(): RuntimeState[] {
    return [...this.runtimes.values()];
  }
}

function isRuntimeStateEvent(type: TradingEvent['type']): boolean {
  return [
    'RUNTIME_PROVISION_REQUESTED',
    'RUNTIME_PROVISION_APPROVED',
    'USER_RUNTIME_PROVISIONED',
    'RUNTIME_STARTED',
    'USER_RUNTIME_PAUSED',
    'RUNTIME_PAUSED',
    'USER_RUNTIME_RESUMED',
    'USER_RUNTIME_SUSPENDED',
    'RUNTIME_RECOVERING',
    'USER_RUNTIME_STOPPED',
    'RUNTIME_TERMINATED',
    'EMERGENCY_SHUTDOWN_TRIGGERED',
  ].includes(type);
}
