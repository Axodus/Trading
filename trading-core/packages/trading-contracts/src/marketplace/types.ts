export interface StrategyMarketplaceListing {
  strategyProductId: string;
  releaseId: string;
  visibility: 'public' | 'token-gated' | 'dao-only' | 'premium';
  publishedAt: string;
  rankingEnabled: boolean;
}
