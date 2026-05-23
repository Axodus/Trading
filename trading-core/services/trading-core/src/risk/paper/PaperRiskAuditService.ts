import type { PaperRiskDecision, PaperRiskEvaluationInput, PaperRiskSignal, TradingEvent } from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';

export class PaperRiskAuditService {
  constructor(private readonly eventBus?: TradingEventBus) {}

  async record(input: PaperRiskEvaluationInput, decisions: PaperRiskDecision[]): Promise<PaperRiskDecision[]> {
    for (const decision of decisions) {
      if (decision.signal) {
        await this.eventBus?.publish(this.signalEvent(input, decision.signal));
      }
      await this.eventBus?.publish(this.decisionEvent(input, decision));
      if (decision.decision === 'require-simulation-retry' || decision.decision === 'require-backtest') {
        await this.eventBus?.publish(this.retryEvent(input, decision));
      }
    }
    return decisions;
  }

  private signalEvent(input: PaperRiskEvaluationInput, signal: PaperRiskSignal): TradingEvent {
    return {
      id: `${signal.id}:created`,
      type: 'PAPER_RISK_SIGNAL_CREATED',
      occurredAt: signal.createdAt,
      correlationId: signal.correlationId,
      source: 'risk',
      daoId: input.daoId,
      federationId: input.federationId,
      userId: input.userId,
      strategyId: input.strategyId,
      strategyProductId: input.strategyProductId,
      runtimeInstanceId: input.runtimeInstanceId,
      payload: {
        signal,
        authorizedExecution: false,
      },
    };
  }

  private decisionEvent(input: PaperRiskEvaluationInput, decision: PaperRiskDecision): TradingEvent {
    return {
      id: `${decision.id}:created`,
      type: this.eventType(decision),
      occurredAt: decision.createdAt,
      correlationId: decision.correlationId,
      source: 'risk',
      daoId: input.daoId,
      federationId: input.federationId,
      userId: input.userId,
      strategyId: input.strategyId,
      strategyProductId: input.strategyProductId,
      runtimeInstanceId: input.runtimeInstanceId,
      payload: {
        decision,
        authorizedExecution: false,
        controlledResumeEligible: decision.controlledResumeEligible,
      },
    };
  }

  private eventType(decision: PaperRiskDecision): TradingEvent['type'] {
    if (decision.decision === 'reject-controlled-resume-eligibility') {
      return 'PAPER_CONTROLLED_RESUME_REJECTED';
    }
    if (decision.decision === 'require-telemetry-review' || decision.decision === 'require-reconciliation-review' || decision.decision === 'require-controlled-resume-approval') {
      return 'PAPER_CONTROLLED_RESUME_REVIEW_REQUIRED';
    }
    if (decision.signal?.signalType === 'paper-fill-quality-degraded' || decision.signal?.signalType === 'paper-slippage-high') {
      return 'PAPER_EXECUTION_QUALITY_DEGRADED';
    }
    return 'PAPER_CONTROLLED_RESUME_REVIEW_REQUIRED';
  }

  private retryEvent(input: PaperRiskEvaluationInput, decision: PaperRiskDecision): TradingEvent {
    return {
      id: `${decision.id}:paper-simulation-retry-required`,
      type: 'PAPER_SIMULATION_RETRY_REQUIRED',
      occurredAt: decision.createdAt,
      correlationId: decision.correlationId,
      source: 'risk',
      daoId: input.daoId,
      federationId: input.federationId,
      userId: input.userId,
      strategyId: input.strategyId,
      strategyProductId: input.strategyProductId,
      runtimeInstanceId: input.runtimeInstanceId,
      payload: {
        decision,
        authorizedExecution: false,
        controlledResumeEligible: false,
      },
    };
  }
}
