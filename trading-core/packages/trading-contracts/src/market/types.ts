export type MarketStateValidityContext = 'live' | 'historical' | 'simulation' | 'paper' | 'testnet';

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
}

export type OpportunityQualification = 'qualified' | 'unqualified' | 'expired' | 'invalid';

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
}
