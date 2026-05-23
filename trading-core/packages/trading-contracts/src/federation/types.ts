export interface FederationTradingProfile {
  federationId: string;
  memberId: string;
  tier: 'observer' | 'operator' | 'governed' | 'sovereign';
  delegatedExecutionAllowed: boolean;
}
