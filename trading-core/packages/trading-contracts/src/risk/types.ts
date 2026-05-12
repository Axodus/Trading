export interface RiskCheckRequest {
  requestId: string;
  asset: string;
  venue: string;
  strategyId?: string;
  notional?: string;
  leverage?: string;
}

export interface RiskCheckResult {
  requestId: string;
  status: 'approved' | 'rejected' | 'review-required';
  violations: string[];
}
