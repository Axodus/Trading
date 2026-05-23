import type {
  ObservabilityQueryContext,
  ObservabilityRiskDecision,
  ObservabilityRiskSignal,
  TradingEvent,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';

export class ObservabilityRiskAuditService {
  constructor(private readonly eventBus?: TradingEventBus) {}

  async record(context: ObservabilityQueryContext, decisions: ObservabilityRiskDecision[]): Promise<ObservabilityRiskDecision[]> {
    for (const decision of decisions) {
      await this.eventBus?.publish(this.toSignalEvent(context, decision.signal));
      await this.eventBus?.publish(this.toDecisionEvent(context, decision));
    }
    return decisions;
  }

  private toSignalEvent(context: ObservabilityQueryContext, signal: ObservabilityRiskSignal): TradingEvent {
    return {
      id: `${signal.id}:created`,
      type: 'OBSERVABILITY_RISK_SIGNAL_CREATED',
      occurredAt: signal.createdAt,
      correlationId: signal.correlationId,
      source: 'risk',
      daoId: context.daoId,
      federationId: context.federationId,
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        tenantId: signal.tenantId,
        providerId: signal.providerId,
        signalType: signal.signalType,
        severity: signal.severity,
        source: signal.source,
        evidence: signal.evidence,
        authorizedExecution: false,
      },
    };
  }

  private toDecisionEvent(context: ObservabilityQueryContext, decision: ObservabilityRiskDecision): TradingEvent {
    return {
      id: `${decision.id}:created`,
      type: this.eventTypeFor(decision),
      occurredAt: decision.createdAt,
      correlationId: decision.correlationId,
      source: 'risk',
      daoId: context.daoId,
      federationId: context.federationId,
      userId: context.userId,
      strategyId: context.strategyId,
      strategyProductId: context.strategyProductId,
      runtimeInstanceId: context.runtimeInstanceId,
      payload: {
        tenantId: decision.tenantId,
        providerId: decision.signal.providerId,
        decision: decision.decision,
        status: decision.status,
        reason: decision.reason,
        requiresAcs: decision.requiresAcs,
        requiresGovernance: decision.requiresGovernance,
        authorizedExecution: decision.authorizedExecution,
        mutatesRuntime: decision.mutatesRuntime,
        mutatesProvider: decision.mutatesProvider,
        mutatesStrategy: decision.mutatesStrategy,
        signalType: decision.signal.signalType,
      },
    };
  }

  private eventTypeFor(decision: ObservabilityRiskDecision): TradingEvent['type'] {
    if (decision.decision === 'recommend-block') {
      return 'PROVIDER_BLOCK_RECOMMENDED';
    }
    if (decision.decision === 'require-recovery') {
      return 'RUNTIME_RECOVERY_REQUIRED';
    }
    if (decision.decision === 'require-simulation' || decision.decision === 'require-backtest') {
      return 'STRATEGY_REVALIDATION_REQUIRED';
    }
    if (decision.decision === 'require-controlled-resume-approval') {
      return 'CONTROLLED_RESUME_REQUIRED';
    }
    return 'OBSERVABILITY_RISK_REVIEW_REQUIRED';
  }
}
