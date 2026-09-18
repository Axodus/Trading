import type { ContinuousKillSwitch } from './ContinuousKillSwitch.js';
import type { ContinuousPositionReconciliationResult } from './ContinuousPositionReconciliationService.js';

export interface ContinuousMarketDataQuote {
  symbol: string;
  price: number;
  bidPrice?: number;
  askPrice?: number;
  timestampMs: number;
}

export interface ContinuousRiskEnvelopeConfig {
  environment: string;
  allowedSymbols: string[];
  maxOrderNotional: number;
  maxPositionNotional: number;
  maxTotalRunNotional: number;
  maxOutstandingOrders: number;
  maxMarketDataAgeMs: number;
  maxPriceDeviationFraction: number;
  minOrderNotional?: number;
}

export interface ContinuousRiskEvaluationRequest {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  price: number;
  quote?: ContinuousMarketDataQuote;
  activeOrdersCount: number;
  accumulatedNotional: number;
  currentPositionNotional: number;
  positionReconciliationResult?: ContinuousPositionReconciliationResult;
  nowMs?: number;
}

export interface ContinuousRiskEvaluationResult {
  approved: boolean;
  violationCode?:
    | 'KILL_SWITCH_ACTIVE'
    | 'ENVIRONMENT_NOT_ALLOWED'
    | 'SYMBOL_NOT_ALLOWED'
    | 'STALE_MARKET_DATA'
    | 'PRICE_DEVIATION_TOO_HIGH'
    | 'MAX_ORDER_NOTIONAL_EXCEEDED'
    | 'MIN_ORDER_NOTIONAL_VIOLATION'
    | 'MAX_POSITION_NOTIONAL_EXCEEDED'
    | 'MAX_TOTAL_NOTIONAL_EXCEEDED'
    | 'MAX_OUTSTANDING_ORDERS_EXCEEDED'
    | 'POSITION_DIVERGENCE_UNRESOLVED';
  reason?: string;
}

export class ContinuousRiskEnvelopeService {
  constructor(
    private readonly config: ContinuousRiskEnvelopeConfig,
    private readonly killSwitch: ContinuousKillSwitch,
  ) {}

  getConfig(): ContinuousRiskEnvelopeConfig {
    return { ...this.config };
  }

  evaluate(request: ContinuousRiskEvaluationRequest): ContinuousRiskEvaluationResult {
    if (this.killSwitch.isActive()) {
      const state = this.killSwitch.getState();
      return {
        approved: false,
        violationCode: 'KILL_SWITCH_ACTIVE',
        reason: 'Kill switch is active (' + (state.reason ?? 'UNKNOWN') + '): ' + (state.details ?? 'No details'),
      };
    }

    if (request.positionReconciliationResult && request.positionReconciliationResult.divergent) {
      return {
        approved: false,
        violationCode: 'POSITION_DIVERGENCE_UNRESOLVED',
        reason: 'Position divergence detected on venue (' + request.positionReconciliationResult.findings.length + ' findings). No new risk allowed.',
      };
    }

    const env = this.config.environment.toLowerCase();
    if (env !== 'testnet' && env !== 'sandbox' && env !== 'paper') {
      return {
        approved: false,
        violationCode: 'ENVIRONMENT_NOT_ALLOWED',
        reason: 'Environment \'' + this.config.environment + '\' is prohibited. Only testnet/sandbox/paper allowed.',
      };
    }

    const normalizedSymbol = request.symbol.toUpperCase();
    if (!this.config.allowedSymbols.map((s) => s.toUpperCase()).includes(normalizedSymbol)) {
      return {
        approved: false,
        violationCode: 'SYMBOL_NOT_ALLOWED',
        reason: 'Symbol \'' + request.symbol + '\' is not on the allowed continuous trading allowlist.',
      };
    }

    const now = request.nowMs ?? Date.now();

    if (request.quote) {
      const ageMs = now - request.quote.timestampMs;
      if (ageMs > this.config.maxMarketDataAgeMs || ageMs < -5000) {
        return {
          approved: false,
          violationCode: 'STALE_MARKET_DATA',
          reason: 'Market data quote for ' + request.symbol + ' is stale (age ' + ageMs + 'ms > max ' + this.config.maxMarketDataAgeMs + 'ms).',
        };
      }

      if (request.orderType === 'limit' && request.price > 0 && request.quote.price > 0) {
        const deviation = Math.abs(request.price - request.quote.price) / request.quote.price;
        if (deviation > this.config.maxPriceDeviationFraction) {
          return {
            approved: false,
            violationCode: 'PRICE_DEVIATION_TOO_HIGH',
            reason: 'Limit price ' + request.price + ' deviates by ' + (deviation * 100).toFixed(2) + '% from mark/quote price ' + request.quote.price + ' (max ' + (this.config.maxPriceDeviationFraction * 100).toFixed(2) + '%).',
          };
        }
      }
    }

    const orderNotional = request.quantity * request.price;

    if (this.config.minOrderNotional !== undefined && orderNotional < this.config.minOrderNotional) {
      return {
        approved: false,
        violationCode: 'MIN_ORDER_NOTIONAL_VIOLATION',
        reason: 'Order notional ' + orderNotional + ' is below minimum allowed floor of ' + this.config.minOrderNotional + '.',
      };
    }

    if (orderNotional > this.config.maxOrderNotional) {
      return {
        approved: false,
        violationCode: 'MAX_ORDER_NOTIONAL_EXCEEDED',
        reason: 'Order notional ' + orderNotional + ' exceeds maximum order ceiling of ' + this.config.maxOrderNotional + '.',
      };
    }

    const projectedPositionNotional = request.currentPositionNotional + orderNotional;
    if (projectedPositionNotional > this.config.maxPositionNotional) {
      return {
        approved: false,
        violationCode: 'MAX_POSITION_NOTIONAL_EXCEEDED',
        reason: 'Projected position notional ' + projectedPositionNotional + ' exceeds position ceiling of ' + this.config.maxPositionNotional + '.',
      };
    }

    if (request.accumulatedNotional + orderNotional > this.config.maxTotalRunNotional) {
      return {
        approved: false,
        violationCode: 'MAX_TOTAL_NOTIONAL_EXCEEDED',
        reason: 'Total run accumulated notional ' + (request.accumulatedNotional + orderNotional) + ' exceeds run ceiling of ' + this.config.maxTotalRunNotional + '.',
      };
    }

    if (request.activeOrdersCount >= this.config.maxOutstandingOrders) {
      return {
        approved: false,
        violationCode: 'MAX_OUTSTANDING_ORDERS_EXCEEDED',
        reason: 'Active orders count ' + request.activeOrdersCount + ' meets or exceeds ceiling of ' + this.config.maxOutstandingOrders + '.',
      };
    }

    return {
      approved: true,
    };
  }
}
