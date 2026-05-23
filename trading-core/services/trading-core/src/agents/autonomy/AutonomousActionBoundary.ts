import type {
  AgentAutonomyLevel,
  AutonomousActionBoundary as AutonomousActionBoundaryContract,
  AutonomousActionDecision,
  TradingEvent,
  TrinityAutonomyProfile,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { TradingEventBus } from '../../telemetry/TradingEventBus.js';
import { AgentAutonomyPolicy } from './AgentAutonomyPolicy.js';

export class AutonomousActionBoundary {
  constructor(
    private readonly profile: TrinityAutonomyProfile,
    private readonly eventBus?: TradingEventBus,
  ) {}

  async evaluate(boundary: AutonomousActionBoundaryContract): Promise<AutonomousActionDecision> {
    const decision = new AgentAutonomyPolicy(this.profile).evaluate(boundary);
    if (boundary.actionType === 'request-simulation') {
      await this.publish(boundary, decision.approved ? 'SIMULATION_APPROVED' : 'SIMULATION_REJECTED', decision.reason);
    } else if (boundary.actionType === 'request-backtest') {
      await this.publish(boundary, decision.approved ? 'BACKTEST_APPROVED' : 'BACKTEST_REJECTED', decision.reason);
    } else if (boundary.actionType === 'production-strategy-mutation') {
      await this.publish(boundary, 'STRATEGY_MUTATION_PROPOSED', decision.reason);
    }

    if (!decision.approved) {
      await this.publish(boundary, 'AUTONOMOUS_ACTION_BLOCKED', decision.reason);
    }

    return decision;
  }

  async requestAutonomyLevelChange(nextLevel: AgentAutonomyLevel, governanceApproved: boolean, context: AutonomousActionBoundaryContract['context'], correlationId: string): Promise<AutonomousActionDecision> {
    const decision = new AgentAutonomyPolicy(this.profile).canEscalateTo(nextLevel, governanceApproved);
    if (decision.approved) {
      await this.eventBus?.publish({
        id: `trinity-autonomy-level-${nextLevel}`,
        type: 'AUTONOMY_LEVEL_CHANGED',
        occurredAt: new Date().toISOString(),
        correlationId,
        source: 'agent',
        daoId: context.daoId,
        userId: context.userId,
        strategyId: context.strategyId,
        strategyProductId: context.strategyProductId,
        runtimeInstanceId: context.runtimeInstanceId,
        payload: {
          providerId: context.providerId,
          agent: 'trinity',
          previousLevel: this.profile.autonomyLevel,
          nextLevel,
        },
      });
    } else {
      await this.publish({ actionType: 'analytics', context }, 'AUTONOMOUS_ACTION_BLOCKED', decision.reason, correlationId);
    }
    return decision;
  }

  private async publish(
    boundary: AutonomousActionBoundaryContract,
    type: Extract<TradingEvent['type'], 'SIMULATION_APPROVED' | 'SIMULATION_REJECTED' | 'BACKTEST_APPROVED' | 'BACKTEST_REJECTED' | 'STRATEGY_MUTATION_PROPOSED' | 'AUTONOMOUS_ACTION_BLOCKED'>,
    reason?: string,
    correlationId?: string,
  ): Promise<void> {
    await this.eventBus?.publish({
      id: `trinity-${type.toLowerCase()}-${boundary.actionType}`,
      type,
      occurredAt: new Date().toISOString(),
      correlationId: correlationId ?? boundary.recommendation?.correlationId ?? `trinity-${boundary.actionType}`,
      source: 'agent',
      daoId: boundary.context.daoId,
      userId: boundary.context.userId,
      strategyId: boundary.context.strategyId,
      strategyProductId: boundary.context.strategyProductId,
      runtimeInstanceId: boundary.context.runtimeInstanceId,
      payload: {
        providerId: boundary.context.providerId,
        actionType: boundary.actionType,
        reason,
        recommendationId: boundary.recommendation?.id,
        agent: 'trinity',
      },
    });
  }
}
