export interface TreasuryExecutionPolicy {
  treasuryId: string;
  maxExposure?: string;
  maxDailyLoss?: string;
  allowedStrategyIds: string[];
}
