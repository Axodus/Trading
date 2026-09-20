import type {
  PositionLedgerEntry,
  ExecutionEnvironment,
  CanonicalFill,
} from '../../../../../packages/trading-contracts/src/index.js';
import { FixedDecimal } from '../../../../../packages/trading-contracts/src/index.js';

export interface PositionStateKey {
  strategyId: string;
  strategyRevisionId: string;
  venue: string;
  instrument: string;
  environment: ExecutionEnvironment;
}

export interface PositionMatchResult {
  closedQuantity: string;
  realizedGrossPnl: string;
  entryAveragePrice?: string;
  exitAveragePrice?: string;
  isPositionClosed: boolean;
  remainingOpenQuantity: string;
  costBasisRemaining: string;
  newPositionCreated?: {
    side: 'long' | 'short';
    quantity: string;
    entryPrice: string;
  };
}

export class PositionAccountingService {
  private readonly ledger = new Map<string, PositionLedgerEntry[]>();

  public getKey(k: PositionStateKey): string {
    return `${k.strategyId}::${k.strategyRevisionId}::${k.venue}::${k.instrument}::${k.environment}`;
  }

  public getOpenEntries(key: PositionStateKey): readonly PositionLedgerEntry[] {
    const k = this.getKey(key);
    return (this.ledger.get(k) ?? []).filter((e) => !e.isFullyClosed);
  }

  public getOpenPositionSummary(key: PositionStateKey): {
    side?: 'long' | 'short';
    totalQuantity: string;
    weightedEntryPrice?: string;
  } {
    const openEntries = this.getOpenEntries(key);
    if (openEntries.length === 0) {
      return { totalQuantity: '0.000000000000' };
    }

    const side = openEntries[0].side;
    let totalQ = FixedDecimal.zero();
    let totalCost = FixedDecimal.zero();

    for (const entry of openEntries) {
      const rem = FixedDecimal.from(entry.remainingQuantity);
      const price = FixedDecimal.from(entry.entryPrice);
      totalQ = totalQ.add(rem);
      totalCost = totalCost.add(rem.mul(price));
    }

    const weightedEntryPrice = totalQ.isPositive() ? totalCost.div(totalQ).toString() : undefined;
    return {
      side,
      totalQuantity: totalQ.toString(),
      weightedEntryPrice,
    };
  }

  public processExecution(
    key: PositionStateKey,
    orderSide: 'buy' | 'sell',
    fillQuantityStr: string,
    realizedPriceStr: string,
    fillId: string,
    timestamp: string
  ): PositionMatchResult {
    const fillQty = FixedDecimal.from(fillQuantityStr);
    const fillPrice = FixedDecimal.from(realizedPriceStr);

    if (fillQty.isZero()) {
      const summary = this.getOpenPositionSummary(key);
      return {
        closedQuantity: '0.000000000000',
        realizedGrossPnl: '0.000000000000',
        isPositionClosed: false,
        remainingOpenQuantity: summary.totalQuantity,
        costBasisRemaining: summary.totalQuantity === '0.000000000000' ? '0.000000000000' : (summary.weightedEntryPrice ?? '0.000000000000'),
      };
    }

    const mapKey = this.getKey(key);
    let entries = this.ledger.get(mapKey);
    if (!entries) {
      entries = [];
      this.ledger.set(mapKey, entries);
    }

    const activeEntries = entries.filter((e) => !e.isFullyClosed);

    if (activeEntries.length === 0) {
      // Net new position
      const newSide: 'long' | 'short' = orderSide === 'buy' ? 'long' : 'short';
      const entryId = `pos-${fillId.slice(0, 16)}-${Date.now()}`;
      const newEntry: PositionLedgerEntry = {
        positionEntryId: entryId,
        strategyId: key.strategyId,
        strategyRevisionId: key.strategyRevisionId,
        venue: key.venue,
        instrument: key.instrument,
        environment: key.environment,
        side: newSide,
        quantity: fillQuantityStr,
        entryPrice: realizedPriceStr,
        entryFillId: fillId,
        openedAt: timestamp,
        closedQuantity: '0.000000000000',
        remainingQuantity: fillQuantityStr,
        isFullyClosed: false,
      };
      entries.push(newEntry);

      return {
        closedQuantity: '0.000000000000',
        realizedGrossPnl: '0.000000000000',
        isPositionClosed: false,
        remainingOpenQuantity: fillQuantityStr,
        costBasisRemaining: realizedPriceStr,
        newPositionCreated: {
          side: newSide,
          quantity: fillQuantityStr,
          entryPrice: realizedPriceStr,
        },
      };
    }

    const currentSide = activeEntries[0].side;
    const isAdding = (currentSide === 'long' && orderSide === 'buy') || (currentSide === 'short' && orderSide === 'sell');

    if (isAdding) {
      // Scale-in to existing position
      const entryId = `pos-${fillId.slice(0, 16)}-${Date.now()}`;
      const newEntry: PositionLedgerEntry = {
        positionEntryId: entryId,
        strategyId: key.strategyId,
        strategyRevisionId: key.strategyRevisionId,
        venue: key.venue,
        instrument: key.instrument,
        environment: key.environment,
        side: currentSide,
        quantity: fillQuantityStr,
        entryPrice: realizedPriceStr,
        entryFillId: fillId,
        openedAt: timestamp,
        closedQuantity: '0.000000000000',
        remainingQuantity: fillQuantityStr,
        isFullyClosed: false,
      };
      entries.push(newEntry);

      const summary = this.getOpenPositionSummary(key);
      return {
        closedQuantity: '0.000000000000',
        realizedGrossPnl: '0.000000000000',
        isPositionClosed: false,
        remainingOpenQuantity: summary.totalQuantity,
        costBasisRemaining: summary.weightedEntryPrice ?? '0.000000000000',
        newPositionCreated: {
          side: currentSide,
          quantity: fillQuantityStr,
          entryPrice: realizedPriceStr,
        },
      };
    }

    // Closing or Reversing
    let qtyToClose = fillQty;
    let closedTotal = FixedDecimal.zero();
    let entryCostTotal = FixedDecimal.zero();

    for (const entry of activeEntries) {
      if (qtyToClose.isZero()) break;
      const rem = FixedDecimal.from(entry.remainingQuantity);
      const closeFromThis = FixedDecimal.min(rem, qtyToClose);
      const entryP = FixedDecimal.from(entry.entryPrice);

      entryCostTotal = entryCostTotal.add(closeFromThis.mul(entryP));
      closedTotal = closedTotal.add(closeFromThis);

      const newClosed = FixedDecimal.from(entry.closedQuantity).add(closeFromThis);
      const newRem = rem.sub(closeFromThis);

      entry.closedQuantity = newClosed.toString();
      entry.remainingQuantity = newRem.toString();
      entry.isFullyClosed = newRem.isZero();

      qtyToClose = qtyToClose.sub(closeFromThis);
    }

    const entryAvgPrice = closedTotal.isPositive() ? entryCostTotal.div(closedTotal) : undefined;
    let realizedGrossPnl = FixedDecimal.zero();

    if (closedTotal.isPositive() && entryAvgPrice) {
      if (currentSide === 'long') {
        // Closed Long (Sell): (exit - entry) * closedQuantity
        realizedGrossPnl = fillPrice.sub(entryAvgPrice).mul(closedTotal);
      } else {
        // Closed Short (Buy): (entry - exit) * closedQuantity
        realizedGrossPnl = entryAvgPrice.sub(fillPrice).mul(closedTotal);
      }
    }

    let newPos: { side: 'long' | 'short'; quantity: string; entryPrice: string } | undefined;
    if (qtyToClose.isPositive()) {
      // Reversal: remaining fill qty opens opposite position
      const revSide: 'long' | 'short' = currentSide === 'long' ? 'short' : 'long';
      const entryId = `pos-rev-${fillId.slice(0, 16)}-${Date.now()}`;
      const revEntry: PositionLedgerEntry = {
        positionEntryId: entryId,
        strategyId: key.strategyId,
        strategyRevisionId: key.strategyRevisionId,
        venue: key.venue,
        instrument: key.instrument,
        environment: key.environment,
        side: revSide,
        quantity: qtyToClose.toString(),
        entryPrice: realizedPriceStr,
        entryFillId: fillId,
        openedAt: timestamp,
        closedQuantity: '0.000000000000',
        remainingQuantity: qtyToClose.toString(),
        isFullyClosed: false,
      };
      entries.push(revEntry);
      newPos = {
        side: revSide,
        quantity: qtyToClose.toString(),
        entryPrice: realizedPriceStr,
      };
    }

    const summary = this.getOpenPositionSummary(key);
    const isPositionClosed = summary.totalQuantity === '0.000000000000';

    return {
      closedQuantity: closedTotal.toString(),
      realizedGrossPnl: realizedGrossPnl.toString(),
      entryAveragePrice: entryAvgPrice?.toString(),
      exitAveragePrice: closedTotal.isPositive() ? realizedPriceStr : undefined,
      isPositionClosed,
      remainingOpenQuantity: summary.totalQuantity,
      costBasisRemaining: summary.weightedEntryPrice ?? '0.000000000000',
      newPositionCreated: newPos,
    };
  }
}

