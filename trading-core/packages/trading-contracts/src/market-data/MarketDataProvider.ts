import type {
  CandleWindowObservation,
  FundingObservation,
  MarketDataFailure,
  MarketDataRequestContext,
  OrderBookSnapshotObservation,
  PriceObservation,
  RateObservation,
  TickerObservation,
} from './types.js';

export class MarketDataBoundaryError extends Error {
  constructor(public readonly failure: MarketDataFailure) {
    super(failure.message);
    this.name = 'MarketDataBoundaryError';
  }
}

export interface CandleWindowRequest {
  venue: string;
  instrument: string;
  interval: string;
  maxRecords: number;
  context: MarketDataRequestContext;
}

export interface HistoricalCandleWindowRequest extends CandleWindowRequest {
  startTime?: number;
  endTime?: number;
}

export interface PriceRequest {
  venue: string;
  instruments: string[];
  context: MarketDataRequestContext;
}

export interface TickerRequest {
  venue: string;
  instrument: string;
  refresh?: boolean;
  maxAgeSeconds?: number;
  context: MarketDataRequestContext;
}

export interface RateRequest {
  venue?: string;
  instrument: string;
  context: MarketDataRequestContext;
}

export interface FundingRequest {
  venue: string;
  instrument: string;
  context: MarketDataRequestContext;
}

export interface OrderBookSnapshotRequest {
  venue: string;
  instrument: string;
  depth: number;
  context: MarketDataRequestContext;
}

export interface AxodusMarketDataProvider {
  getCandleWindow(request: CandleWindowRequest): Promise<CandleWindowObservation>;
  getHistoricalCandleWindow(request: HistoricalCandleWindowRequest): Promise<CandleWindowObservation>;
  getPrices(request: PriceRequest): Promise<Record<string, PriceObservation>>;
  getTickerSnapshot(request: TickerRequest): Promise<TickerObservation>;
  getRate(request: RateRequest): Promise<RateObservation>;
  getFundingInfo(request: FundingRequest): Promise<FundingObservation>;
  getOrderBookSnapshot(request: OrderBookSnapshotRequest): Promise<OrderBookSnapshotObservation>;
}
