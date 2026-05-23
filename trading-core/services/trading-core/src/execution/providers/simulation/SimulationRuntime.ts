import type { BalanceSnapshot, PositionSnapshot } from '../../../../../../packages/trading-contracts/src/index.js';

interface SimulatedBalance {
  total: number;
  available: number;
  locked: number;
}

interface SimulatedPosition {
  market: string;
  quantity: number;
  entryPrice: number;
}

export class SimulationRuntime {
  private readonly balances = new Map<string, SimulatedBalance>();
  private readonly positions = new Map<string, SimulatedPosition>();

  constructor(initialBalances: Record<string, number> = { USDT: 100_000 }) {
    for (const [asset, amount] of Object.entries(initialBalances)) {
      this.balances.set(asset, { total: amount, available: amount, locked: 0 });
    }
  }

  applyFill(fill: { market: string; side: 'buy' | 'sell'; quantity: number; price: number }): void {
    const [baseAsset, quoteAsset] = fill.market.split('-');
    if (!baseAsset || !quoteAsset) {
      throw new Error(`Invalid simulated market: ${fill.market}`);
    }

    const notional = fill.quantity * fill.price;
    this.adjustBalance(baseAsset, fill.side === 'buy' ? fill.quantity : -fill.quantity);
    this.adjustBalance(quoteAsset, fill.side === 'buy' ? -notional : notional);
    this.adjustPosition(fill.market, fill.side === 'buy' ? fill.quantity : -fill.quantity, fill.price);
  }

  getBalances(providerId: string): BalanceSnapshot {
    return {
      providerId,
      capturedAt: new Date().toISOString(),
      balances: [...this.balances.entries()].map(([asset, balance]) => ({
        asset,
        total: balance.total.toString(),
        available: balance.available.toString(),
        locked: balance.locked.toString(),
      })),
    };
  }

  getPositions(providerId: string): PositionSnapshot {
    return {
      providerId,
      capturedAt: new Date().toISOString(),
      positions: [...this.positions.values()].map((position) => ({
        market: position.market,
        side: position.quantity > 0 ? 'long' : position.quantity < 0 ? 'short' : 'flat',
        quantity: Math.abs(position.quantity).toString(),
        entryPrice: position.entryPrice.toString(),
      })),
    };
  }

  private adjustBalance(asset: string, delta: number): void {
    const current = this.balances.get(asset) ?? { total: 0, available: 0, locked: 0 };
    const nextTotal = current.total + delta;
    this.balances.set(asset, {
      total: nextTotal,
      available: current.available + delta,
      locked: current.locked,
    });
  }

  private adjustPosition(market: string, deltaQuantity: number, price: number): void {
    const current = this.positions.get(market) ?? { market, quantity: 0, entryPrice: price };
    const nextQuantity = current.quantity + deltaQuantity;
    this.positions.set(market, {
      market,
      quantity: nextQuantity,
      entryPrice: nextQuantity === 0 ? price : current.entryPrice,
    });
  }
}
