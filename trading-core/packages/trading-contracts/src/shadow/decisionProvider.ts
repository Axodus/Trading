export type ShadowEnvironment = 'PAPER' | 'TESTNET';
export type ShadowProviderStatus =
  | 'SUCCEEDED'
  | 'TIMED_OUT'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'STALE_RESPONSE'
  | 'DUPLICATE_RESPONSE'
  | 'DISABLED';

export type ShadowJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ShadowJsonValue[]
  | { readonly [key: string]: ShadowJsonValue };

export interface ExperimentPolicyIdentity {
  experimentId: string;
  experimentVersion: string;
}

export interface QuestionSetIdentity {
  questionSetId: string;
  questionSetVersion: string;
}

export interface LabelPolicyIdentity {
  labelPolicyId: string;
  labelPolicyVersion: string;
}

export type ShadowQuestion =
  | { questionId: string; type: 'NOUL'; instructions: string }
  | { questionId: string; type: 'CHOICE'; instructions: string; options: Readonly<Record<string, string>> }
  | { questionId: string; type: 'SCORE'; instructions: string; levels: readonly string[] };

export interface ShadowDecisionSnapshot {
  snapshotId: string;
  correlationId: string;
  capturedAt: string;
  environment: ShadowEnvironment;
  strategyId: string;
  strategyRevisionId: string;
  instrument: string;
  marketStateRef: string;
  marketStateDigest: string;
  opportunityRef: string;
  opportunityDigest: string;
  tradeProposalRef: string;
  tradeProposalDigest: string;
  experiment: ExperimentPolicyIdentity;
  questionSet: QuestionSetIdentity;
  requestedProvider: string;
  requestedModel: string;
  providerState: Readonly<Record<string, ShadowJsonValue>>;
  inputDigest: string;
}

export interface ShadowDecisionRequest {
  requestId: string;
  snapshot: ShadowDecisionSnapshot;
  questions: readonly ShadowQuestion[];
  requestedAt: string;
  timeoutMs: number;
  inputDigest: string;
}

export interface ShadowDecisionAnswer {
  questionId: string;
  type: 'NOUL' | 'CHOICE' | 'SCORE';
  value: string;
  confidence?: number;
  probabilities?: Readonly<Record<string, number>>;
}

export interface ShadowProviderAttempt {
  attempt: number;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  outcome: ShadowProviderStatus;
}

export interface ShadowDecisionObservation {
  observationId: string;
  requestId: string;
  snapshotId: string;
  correlationId: string;
  provider: string;
  requestedModel: string;
  resolvedModel?: string;
  status: ShadowProviderStatus;
  answers: readonly ShadowDecisionAnswer[];
  attemptCount: number;
  attempts: readonly ShadowProviderAttempt[];
  totalProviderWallTimeMs: number;
  usage?: { inputTokens?: number; outputTokens?: number; estimatedCostUsd?: string };
  observedAt: string;
  failureCode?: string;
  inputDigest: string;
}

export type CounterfactualProvenance =
  | 'OBSERVED_EXECUTION'
  | 'MARKET_DERIVED_COUNTERFACTUAL'
  | 'SIMULATION_DERIVED_COUNTERFACTUAL'
  | 'NO_DEFENSIBLE_OUTCOME';

export interface ShadowDecisionEvaluation {
  evaluationId: string;
  observationId: string;
  snapshotId: string;
  labelPolicy: LabelPolicyIdentity;
  baselineDecisionRef: string;
  portfolioDecisionRef?: string;
  riskDecisionRef?: string;
  executionResultRef?: string;
  outcomeRef?: string;
  counterfactualProvenance: CounterfactualProvenance;
  scorable: boolean;
  evaluatedAt: string;
  inputDigest: string;
}
