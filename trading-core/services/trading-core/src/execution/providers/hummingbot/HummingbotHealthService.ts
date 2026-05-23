import type { ExecutionProviderStatus } from '../../../../../../packages/trading-contracts/src/index.js';
import { TradingEventBus } from '../../../telemetry/TradingEventBus.js';
import { HummingbotRuntime } from './HummingbotRuntime.js';

export class HummingbotHealthService {
  private lastHealth?: ExecutionProviderStatus['health'];
  private lastConnectorState?: string;
  private eventSequence = 0;

  constructor(
    private readonly providerId: string,
    private readonly runtime: HummingbotRuntime,
    private readonly eventBus?: TradingEventBus,
  ) {}

  async check(correlationId = `${this.providerId}:health`): Promise<ExecutionProviderStatus> {
    const status = await this.runtime.getStatus(this.providerId);
    if (this.lastHealth && this.lastHealth !== status.health) {
      await this.eventBus?.publish({
        id: `${this.providerId}:health:${this.eventSequence++}`,
        type: 'PROVIDER_HEALTH_CHANGED',
        occurredAt: status.checkedAt,
        correlationId,
        source: 'provider',
        payload: { providerId: this.providerId, previous: this.lastHealth, current: status.health },
      });
    }
    if (status.health === 'degraded') {
      await this.eventBus?.publish({
        id: `${this.providerId}:hummingbot-degraded:${this.eventSequence++}`,
        type: 'HUMMINGBOT_RUNTIME_DEGRADED',
        occurredAt: status.checkedAt,
        correlationId,
        source: 'provider',
        payload: { providerId: this.providerId, detail: status.detail },
      });
    }
    this.lastHealth = status.health;

    const connectors = await this.runtime.discoverConnectors();
    const connectorState = JSON.stringify(connectors);
    if (this.lastConnectorState && this.lastConnectorState !== connectorState) {
      await this.eventBus?.publish({
        id: `${this.providerId}:connectors:${this.eventSequence++}`,
        type: 'PROVIDER_CONNECTOR_STATE_CHANGED',
        occurredAt: status.checkedAt,
        correlationId,
        source: 'provider',
        payload: { providerId: this.providerId, connectors },
      });
    }
    for (const connector of connectors.filter((item) => !item.available)) {
      await this.eventBus?.publish({
        id: `${this.providerId}:connector-unavailable:${connector.name}:${this.eventSequence++}`,
        type: 'HUMMINGBOT_CONNECTOR_UNAVAILABLE',
        occurredAt: status.checkedAt,
        correlationId,
        source: 'provider',
        payload: { providerId: this.providerId, connector },
      });
    }
    this.lastConnectorState = connectorState;

    return status;
  }
}
