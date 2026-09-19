export type MarketStateValidityContext = 'live' | 'historical' | 'simulation' | 'paper' | 'testnet';

export type MarketObservationType = 'ticker' | 'bid-ask' | 'order-book' | 'trade' | 'candle' | 'volume' | 'funding' | 'basis' | 'open-interest' | 'unknown';
export type MarketObservationQuality = 'valid' | 'stale' | 'incomplete' | 'gap-detected' | 'invalid' | 'unknown';
export type MarketSequenceStatus = 'not-provided' | 'sequenced' | 'duplicate' | 'gap-detected' | 'out-of-order' | 'unknown';

export interface MarketObservation {
  observationId: string;
  instrument: string;
  venue: string;
  observationType: MarketObservationType;
  eventTime: string;
  observedAt: string;
  receivedAt: string;
  value: Readonly<Record<string, unknown>>;
  sourceRef: string;
  schemaVersion: string;
  quality: MarketObservationQuality;
  sequence?: number;
  sequenceScope?: string;
  reconnectBoundary?: boolean;
}

export interface MarketStateFeature {
  featureId: string;
  featureVersion: string;
  value: string | number | boolean | null;
  unit?: string;
  computedAt: string;
}

export interface MarketState {
  marketStateId: string;
  instrument: string;
  venue?: string;
  timeframe: string;
  marketTime: string;
  observedAt: string;
  constructedAt: string;
  validityContext: MarketStateValidityContext;
  freshness: 'current' | 'stale' | 'historical' | 'unknown';
  schemaVersion: string;
  features: readonly MarketStateFeature[];
  sourceRefs: readonly string[];
  completeness: 'complete' | 'partial' | 'unknown';
  validationRefs: readonly string[];
  observationRefs?: readonly string[];
  constructionVersion?: string;
  qualityStatus?: MarketObservationQuality;
  sequenceStatus?: MarketSequenceStatus;
}

export type OpportunityQualification = 'qualified' | 'unqualified' | 'expired' | 'invalid';
export type OpportunityApplicability = 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
export type OpportunityStatus = 'DETECTED' | 'QUALIFIED' | 'REJECTED' | 'EXPIRED' | 'INVALIDATED';

export interface OpportunityDetectorRef {
  detectorId: string;
  detectorVersion: string;
  methodologyRef: string;
}

export interface Opportunity {
  opportunityId: string;
  instrument: string;
  venue?: string;
  strategyId: string;
  strategyRevisionId: string;
  timeframe: string;
  marketStateId: string;
  qualification: OpportunityQualification;
  expectedCharacteristics: Readonly<Record<string, unknown>>;
  evidenceRefs: readonly string[];
  createdAt: string;
  expiresAt: string;
  opportunityType?: string;
  applicability?: OpportunityApplicability;
  status?: OpportunityStatus;
  detector?: OpportunityDetectorRef;
  validityContext?: MarketStateValidityContext;
  discoveryRunId?: string;
  correlationId?: string;
  qualificationReason?: string;
  idempotencyKey?: string;
}
