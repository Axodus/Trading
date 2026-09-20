import type { ExecutionEnvironment } from './executionLifecycle.js';

export interface FeeEntry {
  asset: string;
  amount: string;
  normalizedAmount?: string;
  source: string;
}

export interface LatencyTaxonomy {
  decisionToIntentMs?: number;
  intentToAttemptMs?: number;
  submissionMs?: number;
  ackMs?: number;
  firstFillMs?: number;
  completionMs?: number;
  cancelMs?: number;
  reconciliationMs?: number;
}

export interface CancellationDiagnostics {
  requestedAt?: string;
  acknowledgedAt?: string;
  timeToCancelMs?: number;
  filledBeforeCancel?: string;
  remainingCancelled?: string;
  reason?: string;
}

export interface ReconciliationDiagnostics {
  observationCount: number;
  duplicateObservationCount: number;
  outOfOrderCount: number;
  sequenceGapCount: number;
  reconciliationAttempts: number;
  recoveryDurationMs?: number;
  discrepanciesCount: number;
}

export type EconomicQuality =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'PENDING_RECONCILIATION'
  | 'UNRESOLVED'
  | 'UNSUPPORTED'
  | 'INVALID';

export interface ExecutionDiagnosticsPolicy {
  policyId: string;
  policyRevision: string;
  slippageReferenceType: 'INTENT_LIMIT_PRICE' | 'ARRIVAL_PRICE' | 'DECISION_MARKET_PRICE';
  defaultAccountingCurrency: string;
  anomalyThresholds: {
    maxLatencyMs: number;
    maxSlippageBps: number;
  };
}

export const DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1: ExecutionDiagnosticsPolicy = {
  policyId: 'DEFAULT_EXECUTION_DIAGNOSTICS_POLICY',
  policyRevision: 'DEFAULT_EXECUTION_DIAGNOSTICS_POLICY_V1',
  slippageReferenceType: 'INTENT_LIMIT_PRICE',
  defaultAccountingCurrency: 'USDT',
  anomalyThresholds: {
    maxLatencyMs: 60000,
    maxSlippageBps: 500,
  },
};

export interface ExecutionDiagnostics {
  diagnosticsId: string;
  executionResultId: string;
  executionIntentId: string;
  canonicalOrderId: string;
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  side: 'buy' | 'sell';
  authorizedQuantity: string;
  executionQuantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  fillRatio: string;
  realizedExecutionPrice?: string;
  referencePrice?: string;
  slippageBps?: string;
  slippageAmount?: string;
  feeBreakdown: readonly FeeEntry[];
  normalizedTotalFee?: string;
  accountingCurrency: string;
  latencies: LatencyTaxonomy;
  anomalies: readonly string[];
  rejectionCategory?: string;
  rejectionReason?: string;
  cancellationDetails?: CancellationDiagnostics;
  reconciliationSummary: ReconciliationDiagnostics;
  quality: EconomicQuality;
  policyId: string;
  policyRevision: string;
  inputDigest: string;
  createdAt: string;
  asOf: string;
}

export interface PnLAttributionPolicy {
  policyId: string;
  policyRevision: string;
  positionMatchingMethod: 'FIFO' | 'WEIGHTED_AVERAGE';
  derivativeContractMultiplier: string;
  defaultAccountingCurrency: string;
}

export const DEFAULT_PNL_ATTRIBUTION_POLICY_V1: PnLAttributionPolicy = {
  policyId: 'DEFAULT_PNL_ATTRIBUTION_POLICY',
  policyRevision: 'DEFAULT_PNL_ATTRIBUTION_POLICY_V1',
  positionMatchingMethod: 'FIFO',
  derivativeContractMultiplier: '1.000000000000',
  defaultAccountingCurrency: 'USDT',
};

export type PositionSide = 'long' | 'short' | 'spot';

export interface PnLAttributionComponent {
  componentId: string;
  pnlAttributionId: string;
  componentType: 'GROSS_PNL' | 'FEE' | 'FUNDING' | 'BORROW_INTEREST' | 'OTHER';
  asset: string;
  rawAmount: string;
  normalizedAmount?: string;
  description: string;
}

export interface PnLAttribution {
  pnlAttributionId: string;
  strategyId: string;
  strategyRevisionId: string;
  executionIntentId: string;
  executionResultId: string;
  canonicalOrderId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  accountingCurrency: string;
  positionSide: PositionSide;
  realizedGrossPnl: string;
  canonicalFees: string;
  canonicalFinancingCosts: string;
  canonicalOtherCosts: string;
  realizedNetPnl: string;
  realizedQuantity: string;
  entryAveragePrice?: string;
  exitAveragePrice?: string;
  isPositionClosed: boolean;
  remainingOpenQuantity: string;
  costBasisRemaining: string;
  fundingPnl?: string;
  borrowInterestCost?: string;
  components: readonly PnLAttributionComponent[];
  quality: EconomicQuality;
  policyId: string;
  policyRevision: string;
  inputDigest: string;
  supersedesId?: string;
  correctionReason?: string;
  createdAt: string;
  asOf: string;
}

export interface PositionLedgerEntry {
  positionEntryId: string;
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  side: 'long' | 'short';
  quantity: string;
  entryPrice: string;
  entryFillId: string;
  openedAt: string;
  closedQuantity: string;
  remainingQuantity: string;
  isFullyClosed: boolean;
}

export interface TradingPerformanceAggregate {
  aggregateId: string;
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  accountingCurrency: string;
  windowStart: string;
  windowEnd: string;
  asOf: string;
  executionCount: number;
  filledQuantity: string;
  grossRealizedPnl: string;
  netRealizedPnl: string;
  totalFees: string;
  totalFeesByAsset: readonly { asset: string; amount: string }[];
  averageSlippageBps?: string;
  totalSlippageAmount?: string;
  fillRatio: string;
  rejectionCount: number;
  cancellationCount: number;
  reconciliationAnomalyCount: number;
  averageLatencyMs?: number;
}

export interface ExpectedVsObservedDivergence {
  slippageDivergenceBps?: string;
  feeDivergence?: string;
  fillRatioDivergence?: string;
  latencyDivergenceMs?: number;
  pnlDivergence?: string;
  details?: Record<string, unknown>;
}

export interface TradingFeedbackSnapshot {
  feedbackSnapshotId: string;
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
  windowStart: string;
  windowEnd: string;
  diagnosticsRefs: readonly string[];
  pnlAttributionRefs: readonly string[];
  aggregate: TradingPerformanceAggregate;
  divergence?: ExpectedVsObservedDivergence;
  quality: EconomicQuality;
  inputDigest: string;
  createdAt: string;
  evidenceRef?: string;
}

