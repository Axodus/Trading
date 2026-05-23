import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import type { RuntimeRepository } from '../repositories/interfaces.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { RuntimeLifecycleService } from './RuntimeLifecycleService.js';

export type RuntimeRecoveryReason =
  | 'provider-disconnect'
  | 'runtime-crash'
  | 'degraded-provider'
  | 'orphan-runtime'
  | 'stale-execution-state';

export class RuntimeRecoveryService {
  constructor(
    private readonly lifecycle: RuntimeLifecycleService,
    private readonly eventBus: TradingEventBus,
    private readonly runtimeRepository?: RuntimeRepository,
  ) {}

  async startRecovery(request: {
    runtimeInstanceId: string;
    correlationId: string;
    reason: RuntimeRecoveryReason;
  }): Promise<void> {
    if (!this.lifecycle.get(request.runtimeInstanceId)) {
      const persisted = await this.runtimeRepository?.findById(request.runtimeInstanceId);
      if (persisted) {
        this.lifecycle.register(persisted);
      }
    }
    const runtime = this.lifecycle.markRecovering(request.runtimeInstanceId);
    await this.publish(runtime, request.correlationId, request.reason);
  }

  private async publish(
    runtime: { id: string; userId: string; providerId: string; strategyProductId: string },
    correlationId: string,
    reason: RuntimeRecoveryReason,
  ): Promise<void> {
    await this.eventBus.publish({
      id: `${runtime.id}:runtime-recovering`,
      type: 'RUNTIME_RECOVERING',
      occurredAt: new Date().toISOString(),
      correlationId,
      source: 'core',
      userId: runtime.userId,
      strategyProductId: runtime.strategyProductId,
      runtimeInstanceId: runtime.id,
      payload: {
        providerId: runtime.providerId,
        reason,
      },
    });
  }
}
