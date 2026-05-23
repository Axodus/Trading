import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import type { CredentialLifecycleService } from '../security/CredentialLifecycleService.js';
import type { CredentialVaultService } from '../security/CredentialVaultService.js';
import type { RuntimeCredentialBindingService } from '../security/RuntimeCredentialBindingService.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { RuntimeLifecycleService } from './RuntimeLifecycleService.js';

export class RuntimeLifecycleCoordinator {
  constructor(
    private readonly lifecycle: RuntimeLifecycleService,
    private readonly eventBus: TradingEventBus,
    private readonly credentials?: RuntimeCredentialBindingService,
    private readonly vault?: CredentialVaultService,
    private readonly credentialLifecycle?: CredentialLifecycleService,
  ) {}

  async pause(runtimeInstanceId: string, correlationId: string, reason?: string): Promise<void> {
    const runtime = this.lifecycle.pause(runtimeInstanceId);
    await this.publish(runtime, correlationId, 'RUNTIME_PAUSED', reason);
  }

  async terminate(runtimeInstanceId: string, correlationId: string, reason?: string): Promise<void> {
    const runtime = this.lifecycle.terminate(runtimeInstanceId);
    const binding = this.credentials?.getTelemetrySafeBinding(runtimeInstanceId);
    const reference = binding ? this.vault?.getReference(binding.vaultRefId) : undefined;
    if (reference && this.credentialLifecycle) {
      await this.credentialLifecycle.revoke(reference, correlationId);
    }
    await this.publish(runtime, correlationId, 'RUNTIME_TERMINATED', reason);
  }

  private async publish(
    runtime: { id: string; userId: string; providerId: string; strategyProductId: string },
    correlationId: string,
    type: Extract<TradingEvent['type'], 'RUNTIME_PAUSED' | 'RUNTIME_TERMINATED'>,
    reason?: string,
  ): Promise<void> {
    await this.eventBus.publish({
      id: `${runtime.id}:${type.toLowerCase()}`,
      type,
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
