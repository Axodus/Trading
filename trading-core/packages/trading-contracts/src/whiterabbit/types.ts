import type { EntitlementState } from '../access/types.js';
import type { TradingRiskDisclosure } from '../compliance/types.js';
import type { ExecutionMode } from '../execution/types.js';
import type { ExecutionFill, ExecutionProviderType, PaperConnectorConfig, PaperTradingSessionState } from '../execution/types.js';
import type { ReconciliationProposal } from '../reconciliation/types.js';
import type { TradingActionRequest, TradingApiResponse } from '../api/types.js';
import type { TradingRecommendation } from '../agents/types.js';
import type { StrategySignal } from '../strategy/types.js';
import type { TradingExecutionContext } from '../runtime/types.js';
import type { CredentialScope } from '../security/types.js';

export type WhiteRabbitUserAction =
  | 'request-access'
  | 'accept-disclosure'
  | 'bind-credential-reference'
  | 'provision-runtime'
  | 'pause-runtime'
  | 'stop-runtime'
  | 'view-telemetry'
  | 'view-quota-usage';

export type WhiteRabbitForbiddenUserAction =
  | 'call-provider'
  | 'call-hummingbot'
  | 'bypass-risk'
  | 'bypass-compliance'
  | 'bypass-product-entitlement'
  | 'override-treasury-policies'
  | 'mutate-strategy-internals';

export interface WhiteRabbitProductView {
  productId: string;
  strategyId: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'deprecated' | 'suspended';
  visibility: 'public' | 'token-gated' | 'dao-only' | 'premium' | 'trial-enabled';
  monetization: 'free' | 'subscription' | 'milestone' | 'staking' | 'dao-access';
  supportedSurfaceTargets: Array<'marketplace' | 'defi' | 'dex' | 'academy' | 'tenant-dao' | 'acs'>;
  allowedUserActions: WhiteRabbitUserAction[];
  forbiddenUserActions: WhiteRabbitForbiddenUserAction[];
  riskLanguage: string;
}

export interface WhiteRabbitAccessView {
  accessStatus: 'granted' | 'blocked' | 'trial' | 'pending';
  entitlementState: EntitlementState;
  tokenGateStatus: 'passed' | 'failed' | 'not-required';
  subscriptionTier?: string;
  subscriptionCompatible: boolean;
  reasons: string[];
}

export interface WhiteRabbitRuntimeView {
  runtimeInstanceId?: string;
  status:
    | 'not-provisioned'
    | 'requested'
    | 'provisioning'
    | 'active'
    | 'paused'
    | 'suspended'
    | 'degraded'
    | 'recovering'
    | 'stopped'
    | 'failed'
    | 'terminated';
  runtimeEnablement: {
    canProvision: boolean;
    canEnableExecution: boolean;
    blockers: string[];
  };
  quotaUsage: {
    activeStrategies: number;
    activeRuntimes: number;
    dailyExecutions: number;
    maxActiveStrategies: number;
    maxConcurrentRuntimes: number;
    maxDailyExecutions?: number;
  };
  pauseAvailable: boolean;
  stopAvailable: boolean;
}

export interface WhiteRabbitRiskView {
  status: 'ok' | 'review-required' | 'blocked';
  disclosuresRequired: boolean;
  riskSummary: string;
  controls: string[];
}

export interface WhiteRabbitTelemetryView {
  runtimeInstanceId?: string;
  executionCount: number;
  lastExecutionAt?: string;
  health: 'unknown' | 'healthy' | 'degraded' | 'offline';
  summary: string;
}

export interface WhiteRabbitDisclosureView {
  required: Array<Pick<TradingRiskDisclosure, 'id' | 'version' | 'category' | 'title' | 'contentRef'>>;
  acceptedDisclosureIds: string[];
  missingDisclosureIds: string[];
  allRequiredAccepted: boolean;
}

export interface WhiteRabbitCredentialBindingView {
  status: 'missing' | 'active' | 'rotated' | 'revoked' | 'suspended';
  providerId?: string;
  vaultRefId?: string;
  accountLabel?: string;
  scopes: CredentialScope[];
  executionReady: boolean;
}

export interface WhiteRabbitBollingerConfig {
  period: number;
  standardDeviation: number;
}

export interface WhiteRabbitAtrConfig {
  period: number;
  adaptationRate: number;
  volatilityFloor: number;
}

export interface WhiteRabbitRsiConfig {
  period: number;
  buyBelow: number;
  sellAbove: number;
}

export interface WhiteRabbitVolumeFilterConfig {
  enabled: boolean;
  minimumRelativeVolume: number;
}

export interface WhiteRabbitCandlestickFilterConfig {
  enabled: boolean;
  allowedPatterns: Array<'engulfing' | 'pin-bar' | 'inside-bar' | 'momentum'>;
}

export interface WhiteRabbitRuntimeConfig {
  bollinger: WhiteRabbitBollingerConfig;
  atr: WhiteRabbitAtrConfig;
  rsi: WhiteRabbitRsiConfig;
  volumeFilter: WhiteRabbitVolumeFilterConfig;
  candlestickFilter: WhiteRabbitCandlestickFilterConfig;
}

export interface WhiteRabbitMarketCandle {
  market: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  pattern?: 'engulfing' | 'pin-bar' | 'inside-bar' | 'momentum' | 'none';
  closedAt: string;
}

export interface WhiteRabbitSignalTrace {
  signalId: string;
  runtimeInstanceId: string;
  market: string;
  bollingerPosition: 'below-lower' | 'inside-band' | 'above-upper';
  atrAdjusted: boolean;
  rsiConfirmed: boolean;
  volumeConfirmed: boolean;
  candlestickConfirmed: boolean;
  reasons: string[];
}

export interface WhiteRabbitRuntimeSignal extends StrategySignal {
  runtimeInstanceId: string;
  strategyProductId: string;
  executionDomain: 'treasury' | 'user';
  market: string;
  trace: WhiteRabbitSignalTrace;
}

export interface WhiteRabbitExecutionProfile {
  strategyId: 'whiterabbit-v1';
  strategyProductId: 'whiterabbit-scalper-futures';
  executionMode: ExecutionMode;
  simulationFirst: true;
  productionMutationAllowed: false;
  supportedLifecycle: Array<'provisioning' | 'simulation' | 'paper-validation' | 'controlled-execution-proposal' | 'pause' | 'resume' | 'degrade'>;
}

export interface WhiteRabbitStrategyState {
  runtimeInstanceId: string;
  context: TradingExecutionContext;
  status: 'provisioned' | 'simulating' | 'paper-validating' | 'running' | 'paused' | 'degraded';
  config: WhiteRabbitRuntimeConfig;
  lastSignal?: WhiteRabbitRuntimeSignal;
  updatedAt: string;
}

export interface WhiteRabbitRuntimeTelemetry {
  runtimeInstanceId: string;
  userId?: string;
  daoId?: string;
  strategyProductId: string;
  signalCount: number;
  lastSignalAction?: WhiteRabbitRuntimeSignal['action'];
  health: 'healthy' | 'degraded' | 'paused';
  updatedAt: string;
}

export interface WhiteRabbitParameterProposal {
  id: string;
  correlationId: string;
  context: TradingExecutionContext;
  proposedBy: 'trinity' | 'governance' | 'risk';
  proposedConfig: Partial<WhiteRabbitRuntimeConfig>;
  simulationCompleted: boolean;
  governanceApproved: boolean;
  riskApproved: boolean;
  productionMutationAllowed: false;
  createdAt: string;
}

export interface WhiteRabbitQuotaView {
  activeStrategies: number;
  activeRuntimes: number;
  dailyExecutions: number;
  maxActiveStrategies: number;
  maxConcurrentRuntimes: number;
  maxDailyExecutions?: number;
  exhausted: boolean;
}

export interface WhiteRabbitTelemetrySummary {
  runtimeInstanceId?: string;
  executionCount: number;
  signalCount?: number;
  lastExecutionAt?: string;
  health: WhiteRabbitTelemetryView['health'];
  sensitiveFieldsExcluded: true;
}

export type WhiteRabbitRuntimeSurfaceView = WhiteRabbitRuntimeView;

export interface WhiteRabbitSurfaceResponse {
  product: WhiteRabbitProductView;
  access: WhiteRabbitAccessView;
  runtime: WhiteRabbitRuntimeSurfaceView;
  risk: WhiteRabbitRiskView;
  telemetry: WhiteRabbitTelemetrySummary;
  disclosures: WhiteRabbitDisclosureView;
  credentialBinding: WhiteRabbitCredentialBindingView;
  quota: WhiteRabbitQuotaView;
  providerCompatibility: {
    supportedProviders: string[];
    selectedProvider?: string;
    compatible: boolean;
  };
  readiness: {
    simulationReady: boolean;
    paperReady: boolean;
    blockers: string[];
  };
}

export interface WhiteRabbitProvisioningRequest {
  userId: string;
  providerId: string;
  strategyProductId: 'whiterabbit-scalper-futures';
  runtimeInstanceId?: string;
}

export type WhiteRabbitSurfaceApiResponse<TData = WhiteRabbitSurfaceResponse> = TradingApiResponse<TData>;

export type WhiteRabbitActionRequest = TradingActionRequest<{
  productId: 'whiterabbit-scalper-futures';
  runtimeInstanceId?: string;
}>;

export interface WhiteRabbitPaperValidationPolicy {
  allowedProviders: ExecutionProviderType[];
  requireTelemetrySummary: boolean;
  requireReconciliationDryRun: boolean;
  requireRiskReviewEligibility: boolean;
  defaultPaperQuantity: string;
}

export interface WhiteRabbitPaperValidationRequest {
  id: string;
  correlationId: string;
  tenantId: string;
  requestedBy: 'acs' | 'product-surface' | 'trinity' | string;
  context: TradingExecutionContext;
  connectorConfig: PaperConnectorConfig;
  runtimeConfig?: WhiteRabbitRuntimeConfig;
  candles: WhiteRabbitMarketCandle[];
  trinityRecommendations?: TradingRecommendation[];
}

export interface WhiteRabbitSimulationEvidence {
  validationId: string;
  paperSessionId: string;
  runtimeInstanceId: string;
  signalId: string;
  signalAction: WhiteRabbitRuntimeSignal['action'];
  normalizedFillCount: number;
  telemetrySummaryPresent: boolean;
  reconciliationProposals: number;
  trinityRecommendationIds: string[];
  generatedAt: string;
  performanceClaim: false;
}

export interface WhiteRabbitPaperValidationDecision {
  id: string;
  correlationId: string;
  tenantId: string;
  context: TradingExecutionContext;
  status: 'approved' | 'rejected' | 'completed';
  paperSession?: PaperTradingSessionState;
  signal?: WhiteRabbitRuntimeSignal;
  fills: ExecutionFill[];
  telemetrySummary?: WhiteRabbitTelemetrySummary;
  reconciliationProposals: ReconciliationProposal[];
  evidence?: WhiteRabbitSimulationEvidence;
  controlledResumeEligible: boolean;
  blockers: string[];
  approvalPath: {
    acsRequired: true;
    governanceRequired: boolean;
    riskReviewRequired: boolean;
    liveExecutionAuthorized: false;
  };
}
