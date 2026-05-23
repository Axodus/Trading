import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import { StateMutationError } from './StateErrors.js';
import { readString, toRecord } from './StateContext.js';
import type { ProviderState, StateProviderStatus } from './StateTypes.js';

export class ProviderStateService {
  private readonly providers = new Map<string, ProviderState>();

  applyEvent(event: TradingEvent): ProviderState | undefined {
    if (!isProviderStateEvent(event.type)) {
      return undefined;
    }

    const payload = toRecord(event.payload);
    const providerId = readString(payload.providerId) ?? readString(toRecord(payload.provider).providerId);
    if (!providerId) {
      throw new StateMutationError('Provider state mutation requires providerId.', 'MISSING_TENANT_CONTEXT');
    }

    const current = this.providers.get(providerId);
    const next: ProviderState = {
      providerId,
      status: current?.status ?? 'healthy',
      updatedAt: event.occurredAt,
      detail: readString(payload.detail) ?? readString(payload.reason) ?? current?.detail,
    };

    if (event.type === 'PROVIDER_HEALTH_CHANGED') {
      next.status = normalizeProviderStatus(readString(payload.current) ?? readString(payload.health));
    } else if (event.type === 'EMERGENCY_SHUTDOWN_TRIGGERED') {
      next.status = 'suspended';
      next.detail = readString(payload.reason) ?? 'emergency shutdown';
    }

    this.providers.set(providerId, next);
    return next;
  }

  get(providerId: string): ProviderState | undefined {
    return this.providers.get(providerId);
  }

  list(): ProviderState[] {
    return [...this.providers.values()];
  }
}

function isProviderStateEvent(type: TradingEvent['type']): boolean {
  return ['PROVIDER_HEALTH_CHANGED', 'EMERGENCY_SHUTDOWN_TRIGGERED'].includes(type);
}

function normalizeProviderStatus(status: string | undefined): StateProviderStatus {
  if (status === 'degraded' || status === 'offline' || status === 'suspended') {
    return status;
  }
  return 'healthy';
}
