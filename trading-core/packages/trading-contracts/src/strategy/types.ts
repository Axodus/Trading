export interface StrategySignal {
  id: string;
  strategyId: string;
  action: 'buy' | 'sell' | 'hold' | 'reduce' | 'close';
  confidence?: number;
  generatedAt: string;
}

export interface StrategyRuntimeState {
  strategyId: string;
  status: 'draft' | 'ready' | 'running' | 'paused' | 'stopped';
  updatedAt: string;
}

export type StrategyLifecycleState =
  | 'IDEA'
  | 'RESEARCH'
  | 'BACKTEST'
  | 'ROBUSTNESS'
  | 'PAPER'
  | 'TESTNET'
  | 'LIMITED_LIVE'
  | 'PRODUCTION'
  | 'MONITOR'
  | 'REVALIDATION'
  | 'DEMOTED'
  | 'RETIRED';

export type StrategyFamily = 'arbitrage' | 'spread' | 'spot-swing' | 'futures-day-trading' | 'futures-scalping' | string;
export type StrategyHealthState = 'UNKNOWN' | 'HEALTHY' | 'DEGRADED' | 'REVALIDATION_REQUIRED' | 'SUSPENDED' | 'RETIRED';
export type PromotionEligibilityState = 'ELIGIBLE' | 'NOT_ELIGIBLE' | 'REVALIDATION_REQUIRED' | 'DISQUALIFIED';

export interface StrategyIdentity {
  strategyId: string;
  family: StrategyFamily;
  name: string;
  organizationId: string;
  tenantId?: string;
  description?: string;
}

export interface StrategyRevision {
  strategy: StrategyIdentity;
  revision: number;
  revisionId: string;
  contentDigest?: string;
  artifactRef: string;
  parameterSchemaRef: string;
  parameterDefaultsRef?: string;
  featureDefinitions: readonly FeatureDependency[];
  marketStateSchemaVersion: string;
  executionAssumptionsRef?: string;
  lifecycleState: StrategyLifecycleState;
  createdAt: string;
  createdBy: string;
  agentAttribution?: AgentAttributionRef;
}

export interface FeatureDependency {
  featureId: string;
  featureVersion: string;
  definitionDigest?: string;
}

export interface FeatureDefinition {
  featureId: string;
  featureVersion: string;
  definitionDigest: string;
  mathematicalDefinition: string;
  inputDependencies: readonly string[];
  outputSemantics: string;
  units?: string;
  normalization?: string;
  lookback?: string;
  provenanceRef: string;
}

export interface AgentAttributionRef {
  agentId: string;
  agentRevision?: string;
  workforceId?: string;
  workforceRevision?: string;
  runId?: string;
  taskId?: string;
}

export interface StrategyLifecycleRecord {
  lifecycleRecordId: string;
  strategyId: string;
  strategyRevisionId: string;
  previousState?: StrategyLifecycleState;
  nextState: StrategyLifecycleState;
  transitionedAt: string;
  rationale: string;
  evidenceRefs: readonly string[];
  eligibilityRef?: string;
  authorityRef?: string;
}

export interface StrategyHealth {
  strategyId: string;
  strategyRevisionId: string;
  state: StrategyHealthState;
  observedAt: string;
  expectedEvidenceRefs: readonly string[];
  observedEvidenceRefs: readonly string[];
  divergenceRefs: readonly string[];
  rationale: string;
}
