import type {
  CredentialAccessDecision,
  CredentialScope,
  ExchangeCredentialBinding,
  TradingExecutionContext,
} from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import { CredentialAccessPolicyEvaluator } from './CredentialAccessPolicyEvaluator.js';
import { InMemoryCredentialVaultRepository } from './InMemoryCredentialVaultRepository.js';

export interface RuntimeCredentialBindingRecord {
  runtimeInstanceId: string;
  userId: string;
  providerId: string;
  vaultRefId: string;
  binding: ExchangeCredentialBinding;
  allowedScopes: CredentialScope[];
  boundAt: string;
}

export class RuntimeCredentialBindingService {
  private readonly runtimeBindings = new Map<string, RuntimeCredentialBindingRecord>();

  constructor(
    private readonly repository: InMemoryCredentialVaultRepository,
    private readonly evaluator = new CredentialAccessPolicyEvaluator(),
    private readonly eventBus?: TradingEventBus,
  ) {}

  async bindRuntime(request: {
    context: TradingExecutionContext;
    vaultRefId: string;
    requiredScopes: CredentialScope[];
    correlationId?: string;
  }): Promise<CredentialAccessDecision> {
    const reference = this.repository.findReference(request.vaultRefId);
    const binding = this.repository.findExchangeBinding(request.vaultRefId);
    const decision = this.evaluator.evaluate({
      context: request.context,
      reference,
      binding,
      requiredScopes: request.requiredScopes,
    });

    if (!decision.approved || !binding || !reference || !request.context.runtimeInstanceId || !request.context.userId) {
      await this.publishAccessDenied(request, decision.reason ?? 'Credential access denied.');
      return decision;
    }

    const record: RuntimeCredentialBindingRecord = {
      runtimeInstanceId: request.context.runtimeInstanceId,
      userId: request.context.userId,
      providerId: request.context.providerId,
      vaultRefId: request.vaultRefId,
      binding,
      allowedScopes: [...decision.allowedScopes],
      boundAt: new Date().toISOString(),
    };
    this.runtimeBindings.set(record.runtimeInstanceId, record);

    await this.eventBus?.publish({
      id: `${record.runtimeInstanceId}:runtime-credential-bound`,
      type: 'RUNTIME_CREDENTIAL_BOUND',
      occurredAt: record.boundAt,
      correlationId: request.correlationId ?? `runtime-credential-bound-${record.runtimeInstanceId}`,
      source: 'security',
      userId: record.userId,
      runtimeInstanceId: record.runtimeInstanceId,
      payload: {
        vaultRefId: record.vaultRefId,
        providerId: record.providerId,
        allowedScopes: record.allowedScopes,
      },
    });

    return decision;
  }

  getRuntimeBinding(runtimeInstanceId: string): RuntimeCredentialBindingRecord | undefined {
    const record = this.runtimeBindings.get(runtimeInstanceId);
    return record
      ? {
          ...record,
          binding: { ...record.binding, scopes: [...record.binding.scopes] },
          allowedScopes: [...record.allowedScopes],
        }
      : undefined;
  }

  getTelemetrySafeBinding(runtimeInstanceId: string): Omit<RuntimeCredentialBindingRecord, 'binding'> | undefined {
    const record = this.runtimeBindings.get(runtimeInstanceId);
    return record
      ? {
          runtimeInstanceId: record.runtimeInstanceId,
          userId: record.userId,
          providerId: record.providerId,
          vaultRefId: record.vaultRefId,
          allowedScopes: [...record.allowedScopes],
          boundAt: record.boundAt,
        }
      : undefined;
  }

  private async publishAccessDenied(
    request: { context: TradingExecutionContext; vaultRefId: string; correlationId?: string },
    reason: string,
  ): Promise<void> {
    await this.eventBus?.publish({
      id: `${request.context.runtimeInstanceId ?? request.vaultRefId}:credential-access-denied`,
      type: 'CREDENTIAL_ACCESS_DENIED',
      occurredAt: new Date().toISOString(),
      correlationId: request.correlationId ?? `credential-access-denied-${request.vaultRefId}`,
      source: 'security',
      userId: request.context.userId,
      runtimeInstanceId: request.context.runtimeInstanceId,
      payload: {
        vaultRefId: request.vaultRefId,
        providerId: request.context.providerId,
        reason,
      },
    });
  }
}
