export interface PortfolioState {
  ownerId: string;
  ownerType: 'treasury' | 'user';
  capturedAt: string;
  totalValue?: string;
  exposures: Array<{
    asset: string;
    notional: string;
  }>;
}
