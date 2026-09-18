import type {
  ReconciliationFinding,
} from '../../../../../packages/trading-contracts/src/index.js';

export interface ContinuousPositionRecord {
  market: string;
  symbol: string;
  side: 'buy' | 'sell' | 'long' | 'short' | 'both';
  quantity: string;
  entryPrice?: string;
  unrealizedPnl?: string;
  updatedAt: string;
}

export interface ContinuousPositionReconciliationResult {
  divergent: boolean;
  status: 'MATCH' | 'DIVERGENT' | 'VENUE_ONLY' | 'LOCAL_ONLY';
  findings: ReconciliationFinding[];
  localPositions: ContinuousPositionRecord[];
  venuePositions: ContinuousPositionRecord[];
}

export interface ContinuousPositionProvider {
  getPositions(market?: string): Promise<ContinuousPositionRecord[]>;
}

export class ContinuousPositionReconciliationService {
  constructor(
    private readonly defaultProviderId = 'binance-perpetual-testnet',
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  reconcile(
    localPositions: ContinuousPositionRecord[],
    venuePositions: ContinuousPositionRecord[],
    providerId = this.defaultProviderId,
  ): ContinuousPositionReconciliationResult {
    const findings: ReconciliationFinding[] = [];
    const venueMap = new Map<string, ContinuousPositionRecord>();

    for (const vp of venuePositions) {
      venueMap.set(this.key(vp.market, vp.side), vp);
    }

    const localMap = new Map<string, ContinuousPositionRecord>();
    for (const lp of localPositions) {
      localMap.set(this.key(lp.market, lp.side), lp);
    }

    let status: ContinuousPositionReconciliationResult['status'] = 'MATCH';

    for (const [key, lp] of localMap.entries()) {
      const vp = venueMap.get(key);
      if (!vp) {
        if (Number(lp.quantity) > 0) {
          status = 'DIVERGENT';
          findings.push({
            type: 'position-divergence',
            state: 'divergent',
            severity: 'critical',
            message: 'Local position exists for ' + lp.market + ':' + lp.side + ' (qty ' + lp.quantity + ') but not found on venue.',
            providerId,
            market: lp.market,
          });
        }
      } else {
        const localQty = Number(lp.quantity);
        const venueQty = Number(vp.quantity);
        if (Math.abs(localQty - venueQty) > 1e-8) {
          status = 'DIVERGENT';
          findings.push({
            type: 'position-divergence',
            state: 'divergent',
            severity: 'critical',
            message: 'Position quantity divergence on ' + lp.market + ':' + lp.side + '. Local: ' + lp.quantity + ', Venue: ' + vp.quantity,
            providerId,
            market: lp.market,
          });
        }
      }
    }

    for (const [key, vp] of venueMap.entries()) {
      const lp = localMap.get(key);
      if (!lp && Number(vp.quantity) > 0) {
        status = 'DIVERGENT';
        findings.push({
          type: 'position-divergence',
          state: 'divergent',
          severity: 'critical',
          message: 'Unexpected venue position for ' + vp.market + ':' + vp.side + ' (qty ' + vp.quantity + ') with no local record.',
          providerId,
          market: vp.market,
        });
      }
    }

    return {
      divergent: findings.length > 0,
      status: findings.length > 0 ? 'DIVERGENT' : 'MATCH',
      findings,
      localPositions,
      venuePositions,
    };
  }

  private key(market: string, side: string): string {
    const normalizedSide = side.toLowerCase() === 'buy' ? 'long' : side.toLowerCase() === 'sell' ? 'short' : side.toLowerCase();
    return market.toUpperCase() + ':' + normalizedSide;
  }
}
