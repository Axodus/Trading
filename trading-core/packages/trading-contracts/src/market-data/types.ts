export type MarketDataFailureCode =
  | 'MARKET_DATA_UNAVAILABLE'
  | 'MARKET_DATA_TIMEOUT'
  | 'MARKET_DATA_TRANSPORT_FAILURE'
  | 'MARKET_DATA_PROTOCOL_FAILURE'
  | 'MARKET_DATA_BASELINE_MISMATCH'
  | 'MARKET_DATA_CAPABILITY_NOT_ADMITTED'
  | 'MARKET_DATA_INVALID_REQUEST';

export type MarketDataOperation =
  | 'get-candle-window'
  | 'get-historical-candle-window'
  | 'get-prices'
  | 'get-ticker-snapshot'
  | 'get-rates'
  | 'get-funding-info'
  | 'get-order-book-snapshot';

export interface MarketDataRequestContext {
  correlationId: string;
  sourceReference?: string;
}

export interface MarketDataObservationMetadata {
  venue: string;
  instrument: string;
  observedAt: string;
  receivedAt: string;
  sourceTimestamp?: string;
  correlationId: string;
  sourceReference?: string;
  freshness: 'current' | 'historical' | 'unknown';
  continuous: false;
  lossless: false;
  sequenced: false;
  gapRecovered: false;
  replayable: false;
}

export interface CandleObservation {
  metadata: MarketDataObservationMetadata;
  interval: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface CandleWindowObservation {
  metadata: MarketDataObservationMetadata;
  interval: string;
  candles: CandleObservation[];
}

export interface PriceObservation {
  metadata: MarketDataObservationMetadata;
  price: string;
}

export interface TickerObservation extends PriceObservation {
  baseVolume?: string;
  quoteVolume?: string;
}

export interface RateObservation extends PriceObservation {
  quoteToken?: string;
}

export interface FundingObservation {
  metadata: MarketDataObservationMetadata;
  fundingRate?: string;
  nextFundingAt?: string;
  markPrice?: string;
  indexPrice?: string;
}

export interface OrderBookLevel {
  price: string;
  amount: string;
}

export interface OrderBookSnapshotObservation {
  metadata: MarketDataObservationMetadata;
  depth: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface MarketDataFailure {
  code: MarketDataFailureCode;
  operation: MarketDataOperation;
  message: string;
  retryable: boolean;
  upstreamStatus?: number;
  upstreamCode?: string;
}
