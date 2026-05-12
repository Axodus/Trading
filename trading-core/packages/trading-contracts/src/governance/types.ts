export interface GovernanceExecutionContext {
  governanceStatus: 'active' | 'restricted' | 'halted';
  constitutionalStanding: 'compliant' | 'review-required' | 'blocked';
  strategyWhitelisted: boolean;
  proposalTriggered?: boolean;
}
