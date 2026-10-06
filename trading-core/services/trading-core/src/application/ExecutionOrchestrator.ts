import {
  EXECUTION_ORDER_SUBMIT_ACTION,
  executionOrderResource,
  validateExecutionAuthorityContext,
  type ExecutionAuthorityContextErrorCode,
  type ExecutionProvider,
} from '../../../../packages/trading-contracts/src/index.js';
import type { ExecutionIntent, TradingExecutionReceipt } from './ExecutionIntent.js';
import { ExecutionProviderRegistry } from '../execution/ExecutionProviderRegistry.js';
import { GovernanceExecutionGuard } from '../governance/GovernanceExecutionGuard.js';
import { ProductExecutionGate } from '../product/ProductExecutionGate.js';
import { RiskGateway } from '../risk/RiskGateway.js';
import { TradingEventBus } from '../telemetry/TradingEventBus.js';

export class ExecutionBlockedError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_EXECUTION_CONTEXT'
      | 'PRODUCT_GATE_BLOCKED'
      | 'GOVERNANCE_GATE_BLOCKED'
      | 'RISK_REJECTED'
      | 'PROVIDER_NOT_FOUND'
      | ExecutionAuthorityContextErrorCode,
  ) {
    super(message);
    this.name = 'ExecutionBlockedError';
  }
}

export interface ExecutionOrchestratorDependencies {
  providers: ExecutionProviderRegistry;
  productGate: ProductExecutionGate;
  governanceGuard: GovernanceExecutionGuard;
  riskGateway: RiskGateway;
  eventBus: TradingEventBus;
}

export class ExecutionOrchestrator {
  constructor(private readonly deps: ExecutionOrchestratorDependencies) {}

  async execute(intent: ExecutionIntent): Promise<TradingExecutionReceipt> {
    this.assertValidIntent(intent);

    await this.deps.eventBus.publish({
      id: `${intent.id}:execution-requested`,
      type: 'EXECUTION_REQUESTED',
      occurredAt: new Date().toISOString(),
      correlationId: intent.correlationId,
      source: 'core',
      daoId: intent.context.daoId,
      federationId: intent.context.federationId,
      userId: intent.context.userId,
      strategyId: intent.context.strategyId,
      strategyProductId: intent.context.strategyProductId,
      runtimeInstanceId: intent.context.runtimeInstanceId,
      payload: { intentId: intent.id, providerId: intent.context.providerId },
    });

    await this.authorizeByDomain(intent);
    await this.assertRiskApproved(intent);

    const provider = this.deps.providers.get(intent.context.providerId);
    if (!provider) {
      throw new ExecutionBlockedError(`Execution provider not found: ${intent.context.providerId}`, 'PROVIDER_NOT_FOUND');
    }

    const executionRequest = {
      ...intent.request,
      clientOrderId: intent.request.clientOrderId ?? intent.correlationId,
    };
    const result = await provider.executeOrder(executionRequest);

    return {
      intentId: intent.id,
      correlationId: intent.correlationId,
      providerId: provider.id,
      result,
      events: this.deps.eventBus.getByCorrelationId(intent.correlationId),
    };
  }

  private async authorizeByDomain(intent: ExecutionIntent): Promise<void> {
    const productDecision = await this.deps.productGate.authorize(intent);
    if (!productDecision.approved) {
      await this.deps.eventBus.publish({
        id: `${intent.id}:strategy-access-revoked`,
        type: 'STRATEGY_ACCESS_REVOKED',
        occurredAt: new Date().toISOString(),
        correlationId: intent.correlationId,
        source: 'product',
        userId: intent.context.userId,
        strategyId: intent.context.strategyId,
        strategyProductId: intent.context.strategyProductId,
        runtimeInstanceId: intent.context.runtimeInstanceId,
        payload: { reason: productDecision.reason ?? 'Product entitlement missing' },
      });
      throw new ExecutionBlockedError(productDecision.reason ?? 'Product gate blocked execution', 'PRODUCT_GATE_BLOCKED');
    }

    const governanceDecision = await this.deps.governanceGuard.authorize(intent);
    if (!governanceDecision.approved) {
      await this.deps.eventBus.publish({
        id: `${intent.id}:governance-blocked`,
        type: 'GOVERNANCE_EXECUTION_BLOCKED',
        occurredAt: new Date().toISOString(),
        correlationId: intent.correlationId,
        source: 'governance',
        daoId: intent.context.daoId,
        federationId: intent.context.federationId,
        strategyId: intent.context.strategyId,
        payload: { reason: governanceDecision.reason ?? 'Governance approval missing' },
      });
      throw new ExecutionBlockedError(governanceDecision.reason ?? 'Governance gate blocked execution', 'GOVERNANCE_GATE_BLOCKED');
    }
  }

  private async assertRiskApproved(intent: ExecutionIntent): Promise<void> {
    await this.deps.eventBus.publish({
      id: `${intent.id}:risk-requested`,
      type: 'RISK_CHECK_REQUESTED',
      occurredAt: new Date().toISOString(),
      correlationId: intent.correlationId,
      source: 'risk',
      daoId: intent.context.daoId,
      federationId: intent.context.federationId,
      userId: intent.context.userId,
      strategyId: intent.context.strategyId,
      strategyProductId: intent.context.strategyProductId,
      runtimeInstanceId: intent.context.runtimeInstanceId,
      payload: { intentId: intent.id },
    });

    const result = await this.deps.riskGateway.check(intent);
    if (result.status !== 'approved') {
      await this.deps.eventBus.publish({
        id: `${intent.id}:risk-rejected`,
        type: 'RISK_CHECK_REJECTED',
        occurredAt: new Date().toISOString(),
        correlationId: intent.correlationId,
        source: 'risk',
        daoId: intent.context.daoId,
        federationId: intent.context.federationId,
        userId: intent.context.userId,
        strategyId: intent.context.strategyId,
        strategyProductId: intent.context.strategyProductId,
        runtimeInstanceId: intent.context.runtimeInstanceId,
        payload: { violations: result.violations },
      });
      throw new ExecutionBlockedError('Risk gateway rejected execution', 'RISK_REJECTED');
    }

    await this.deps.eventBus.publish({
      id: `${intent.id}:risk-approved`,
      type: 'RISK_CHECK_APPROVED',
      occurredAt: new Date().toISOString(),
      correlationId: intent.correlationId,
      source: 'risk',
      daoId: intent.context.daoId,
      federationId: intent.context.federationId,
      userId: intent.context.userId,
      strategyId: intent.context.strategyId,
      strategyProductId: intent.context.strategyProductId,
      runtimeInstanceId: intent.context.runtimeInstanceId,
      payload: { intentId: intent.id },
    });
  }

  private assertValidIntent(intent: ExecutionIntent): void {
    const authorityValidation = validateExecutionAuthorityContext(intent.authorityContext);
    if (!authorityValidation.valid) {
      throw new ExecutionBlockedError(
        authorityValidation.reasons.join('; '),
        authorityValidation.code ?? 'EXECUTION_AUTHORITY_CONTEXT_MISSING',
      );
    }
    const authorityContext = intent.authorityContext;
    if (!authorityContext) {
      throw new ExecutionBlockedError(
        'Execution authority context is required.',
        'EXECUTION_AUTHORITY_CONTEXT_MISSING',
      );
    }

    if (!intent.context) {
      throw new ExecutionBlockedError('Execution context is required', 'INVALID_EXECUTION_CONTEXT');
    }

    if (!intent.context.executionDomain || !intent.context.providerId) {
      throw new ExecutionBlockedError('Execution context requires executionDomain and providerId', 'INVALID_EXECUTION_CONTEXT');
    }

    if (!intent.context.tenantId) {
      throw new ExecutionBlockedError(
        'Execution context requires an explicit canonical tenant id.',
        'EXECUTION_TENANT_MISSING',
      );
    }

    if (!intent.context.principalRef) {
      throw new ExecutionBlockedError(
        'Execution context requires an explicit principal reference.',
        'EXECUTION_PRINCIPAL_MISSING',
      );
    }

    if (!intent.request?.requestId || !intent.request.providerId) {
      throw new ExecutionBlockedError('Execution request requires requestId and providerId', 'INVALID_EXECUTION_CONTEXT');
    }

    if (authorityContext.executionIntentId !== intent.id) {
      throw new ExecutionBlockedError(
        'Execution authority context does not match the protected execution intent.',
        'EXECUTION_AUTHORITY_CONTEXT_MISSING',
      );
    }

    if (authorityContext.tenantId !== intent.context.tenantId) {
      throw new ExecutionBlockedError(
        'Execution authority tenant does not match the execution context tenant.',
        'EXECUTION_TENANT_MISMATCH',
      );
    }

    if (authorityContext.principalRef !== intent.context.principalRef) {
      throw new ExecutionBlockedError(
        'Execution authority principal does not match the execution context principal.',
        'EXECUTION_PRINCIPAL_MISMATCH',
      );
    }

    if (authorityContext.action !== EXECUTION_ORDER_SUBMIT_ACTION) {
      throw new ExecutionBlockedError(
        'Execution authority action does not match order submission.',
        'EXECUTION_ACTION_MISMATCH',
      );
    }

    const expectedResource = executionOrderResource(intent.request.providerId, intent.request.market);
    if (authorityContext.resource !== expectedResource) {
      throw new ExecutionBlockedError(
        'Execution authority resource does not match the requested provider and market.',
        'EXECUTION_RESOURCE_MISMATCH',
      );
    }
  }
}
