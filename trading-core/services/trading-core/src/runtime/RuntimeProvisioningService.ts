import type {
  CredentialScope,
  ExecutionRequest,
  StrategyProduct,
  TradingExecutionContext,
  TradingEvent,
  TradingRiskDisclosure,
  UserRuntimeInstance,
  UserTradingProfile,
} from '../../../../packages/trading-contracts/src/index.js';
import type { RiskGateway } from '../risk/RiskGateway.js';
import type { RuntimeCredentialBindingService } from '../security/RuntimeCredentialBindingService.js';
import type { TradingEventBus } from '../telemetry/TradingEventBus.js';
import type { RuntimeComplianceValidator } from '../compliance/RuntimeComplianceValidator.js';
import { RuntimeLifecycleService, type RuntimeRecord } from './RuntimeLifecycleService.js';
import { RuntimeProvisioningPolicy } from './RuntimeProvisioningPolicy.js';

export interface RuntimeProvisioningRequest {
  id: string;
  correlationId: string;
  context: TradingExecutionContext;
  product: StrategyProduct;
  profile: UserTradingProfile;
  disclosures: TradingRiskDisclosure[];
  vaultRefId?: string;
  requiredCredentialScopes: CredentialScope[];
  riskRequest?: ExecutionRequest;
}

export interface RuntimeProvisioningDecision {
  approved: boolean;
  reason?: string;
  runtime?: UserRuntimeInstance;
  record?: RuntimeRecord;
}

export interface RuntimeProvisioningServiceDependencies {
  lifecycle: RuntimeLifecycleService;
  compliance: RuntimeComplianceValidator;
  credentials: RuntimeCredentialBindingService;
  riskGateway: RiskGateway;
  eventBus: TradingEventBus;
  policy?: RuntimeProvisioningPolicy;
}

export class RuntimeProvisioningService {
  private readonly policy: RuntimeProvisioningPolicy;

  constructor(private readonly deps: RuntimeProvisioningServiceDependencies) {
    this.policy = deps.policy ?? new RuntimeProvisioningPolicy(deps.lifecycle);
  }

  async provision(request: RuntimeProvisioningRequest): Promise<RuntimeProvisioningDecision> {
    const runtimeId = request.context.runtimeInstanceId ?? `runtime-${request.profile.userId}-${request.product.id}-${request.context.providerId}`;
    const context = {
      ...request.context,
      runtimeInstanceId: runtimeId,
    };

    await this.publish(request, context, 'RUNTIME_PROVISION_REQUESTED');

    const policyDecision = this.policy.evaluate({ context, product: request.product, profile: request.profile });
    if (!policyDecision.approved) {
      return this.reject(request, context, policyDecision.reason ?? 'Runtime provisioning policy rejected.');
    }

    const complianceDecision = await this.deps.compliance.validateProvisioning({
      context,
      disclosures: request.disclosures,
      correlationId: request.correlationId,
    });
    if (!complianceDecision.approved) {
      return this.reject(request, context, complianceDecision.reason ?? 'Runtime compliance rejected provisioning.');
    }

    if (!request.vaultRefId) {
      return this.reject(request, context, 'Runtime credential binding is required.');
    }
    const credentialDecision = await this.deps.credentials.bindRuntime({
      context,
      vaultRefId: request.vaultRefId,
      requiredScopes: request.requiredCredentialScopes,
      correlationId: request.correlationId,
    });
    if (!credentialDecision.approved) {
      return this.reject(request, context, credentialDecision.reason ?? 'Runtime credential binding rejected.');
    }

    const riskResult = await this.deps.riskGateway.check({
      id: `${request.id}:runtime-risk`,
      correlationId: request.correlationId,
      context,
      request: request.riskRequest ?? {
        requestId: `${request.id}:runtime-provision-risk`,
        providerId: context.providerId,
        market: 'BTC-USDT',
        side: 'buy',
        orderType: 'market',
        quantity: '0',
      },
    });
    if (riskResult.status !== 'approved') {
      return this.reject(request, context, `Runtime risk rejected provisioning: ${riskResult.violations.join('; ')}`);
    }

    await this.publish(request, context, 'RUNTIME_PROVISION_APPROVED');
    const now = new Date().toISOString();
    const runtime: UserRuntimeInstance = {
      id: runtimeId,
      userId: request.profile.userId,
      strategyProductId: request.product.id,
      providerId: context.providerId,
      executionDomain: 'user',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    const record = this.deps.lifecycle.register(runtime);
    await this.publish(request, context, 'RUNTIME_STARTED');

    return {
      approved: true,
      runtime,
      record,
    };
  }

  private async reject(
    request: RuntimeProvisioningRequest,
    context: TradingExecutionContext,
    reason: string,
  ): Promise<RuntimeProvisioningDecision> {
    await this.publish(request, context, 'RUNTIME_PROVISION_REJECTED', reason);
    return {
      approved: false,
      reason,
    };
  }

  private async publish(
    request: RuntimeProvisioningRequest,
    context: TradingExecutionContext,
    type: Extract<TradingEvent['type'], 'RUNTIME_PROVISION_REQUESTED' | 'RUNTIME_PROVISION_APPROVED' | 'RUNTIME_PROVISION_REJECTED' | 'RUNTIME_STARTED'>,
    reason?: string,
  ): Promise<void> {
    await this.deps.eventBus.publish({
      id: `${request.id}:${type.toLowerCase()}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: request.correlationId,
      source: 'core',
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        providerId: context.providerId,
        reason,
      },
    });
  }
}
