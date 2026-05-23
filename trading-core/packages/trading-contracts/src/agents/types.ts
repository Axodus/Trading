import type { AcsTradingRecommendation } from '../acs/types.js';
import type { TradingExecutionContext } from '../runtime/types.js';
import type { WhiteRabbitMarketCandle } from '../whiterabbit/types.js';

export type TradingRecommendationType =
  | 'pause-strategy'
  | 'resume-strategy'
  | 'adjust-parameter'
  | 'rotate-pair'
  | 'reduce-exposure'
  | 'increase-hedge'
  | 'request-backtest'
  | 'request-simulation'
  | 'recommend-provider-block'
  | 'recommend-runtime-recovery'
  | 'recommend-strategy-pause'
  | 'recommend-simulation'
  | 'recommend-backtest'
  | 'recommend-telemetry-review'
  | 'recommend-controlled-resume';

export interface TrinityTradingIntent {
  id: string;
  correlationId: string;
  tenantId: string;
  context: TradingExecutionContext;
  marketSnapshot?: {
    volatility?: number;
    spreadBps?: number;
    liquidityScore?: number;
    trendStrength?: number;
  };
  providerSnapshot?: {
    health?: 'healthy' | 'degraded' | 'offline';
  };
  strategySnapshot?: {
    degradationScore?: number;
    drawdownPct?: number;
  };
  runtimeSnapshot?: {
    health?: 'healthy' | 'degraded' | 'offline';
    staleExecutionState?: boolean;
  };
  marketCandles?: WhiteRabbitMarketCandle[];
  spreadMetrics?: {
    currentSpreadBps: number;
    averageSpreadBps: number;
    deteriorationPct?: number;
  };
  liquiditySnapshot?: {
    liquidityScore: number;
    depthUsd?: string;
  };
  runtimeTelemetry?: {
    latencyMs?: number;
    errorRate?: number;
    staleExecutionState?: boolean;
  };
  providerQualityTelemetry?: {
    degradationScore?: number;
    slippageBps?: number;
    fillRate?: number;
    rejectionRate?: number;
  };
  strategyPerformanceTelemetry?: {
    degradationScore?: number;
    drawdownPct?: number;
    signalFailureRate?: number;
  };
}

export interface TradingRecommendation {
  id: string;
  correlationId: string;
  tenantId: string;
  producedByAgent: 'trinity';
  context: TradingExecutionContext;
  recommendationType: TradingRecommendationType;
  confidence: number;
  rationale: string;
  createdAt: string;
  requiresAcs: true;
  authorizedExecution: false;
  proposedAction?: Record<string, unknown>;
}

export interface TrinityRecommendationRequest {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: 'trinity' | string;
  recommendation: TradingRecommendation;
  autonomyLevel: AgentAutonomyLevel;
  governanceContext: {
    governanceApproved?: boolean;
    riskApproved?: boolean;
    complianceApproved?: boolean;
    reason?: string;
  };
}

export interface TrinityMarketAnalysis {
  regime: 'calm' | 'volatile' | 'trending' | 'illiquid';
  volatility: 'low' | 'medium' | 'high';
  spread: 'tight' | 'normal' | 'wide';
  liquidity: 'deep' | 'normal' | 'thin';
  providerHealth: 'healthy' | 'degraded' | 'offline' | 'unknown';
}

export interface TrinityMarketIntelligenceReport {
  regime: TrinityMarketAnalysis['regime'];
  volatilityScore: number;
  volatilitySpike: boolean;
  spreadDeteriorated: boolean;
  providerQualityScore: number;
  providerDegraded: boolean;
  strategyDegraded: boolean;
  runtimeLatencySpike: boolean;
  runtimeAnomaly: boolean;
  recommendedProtections: Array<
    | 'reduce-exposure'
    | 'rotate-pair'
    | 'recommend-provider-block'
    | 'recommend-runtime-recovery'
    | 'pause-strategy'
    | 'request-simulation'
  >;
}

export interface TrinityRecommendationEvaluation {
  approvedForAcsIntake: boolean;
  reason?: string;
  acsRecommendation?: AcsTradingRecommendation;
}

export type AgentAutonomyLevel = 0 | 1 | 2 | 3 | 4;

export type AutonomousActionType =
  | 'analytics'
  | 'request-simulation'
  | 'request-backtest'
  | 'paper-parameter-adjustment'
  | 'controlled-execution-proposal'
  | 'production-strategy-mutation'
  | 'treasury-execution-mutation';

export interface AgentAutonomyPolicy {
  agentId: string;
  autonomyLevel: AgentAutonomyLevel;
  governanceApproved: boolean;
  riskApproved: boolean;
  complianceApproved: boolean;
  treasuryMutationAllowed: false;
  simulationRequiredBeforeMutation: true;
  selfEscalationAllowed: false;
}

export interface TrinityAutonomyProfile extends AgentAutonomyPolicy {
  agentId: 'trinity';
  allowedRecommendationTypes: TradingRecommendationType[];
}

export interface SimulationApprovalPolicy {
  simulationRequired: boolean;
  backtestRequired: boolean;
  paperValidationRequired: boolean;
  simulationCompleted?: boolean;
  backtestCompleted?: boolean;
  paperValidationCompleted?: boolean;
}

export interface BacktestGovernancePolicy {
  governanceApproved: boolean;
  riskApproved: boolean;
  minimumBacktestRuns?: number;
  completedBacktestRuns?: number;
}

export interface StrategyMutationPolicy {
  productionMutationRequested: boolean;
  mutationType?: Extract<TradingRecommendationType, 'adjust-parameter' | 'rotate-pair' | 'reduce-exposure' | 'increase-hedge' | 'recommend-provider-block' | 'recommend-runtime-recovery'>;
  simulationPolicy: SimulationApprovalPolicy;
  governancePolicy: BacktestGovernancePolicy;
}

export interface AutonomousActionBoundary {
  actionType: AutonomousActionType;
  context: TradingExecutionContext;
  recommendation?: TradingRecommendation;
  mutationPolicy?: StrategyMutationPolicy;
}

export interface AutonomousActionDecision {
  approved: boolean;
  reason?: string;
  autonomyLevel: AgentAutonomyLevel;
  actionType: AutonomousActionType;
}
