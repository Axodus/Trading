import type {
  AxodusMarketDataProvider,
  CandleWindowObservation,
  CandleWindowRequest,
  FundingObservation,
  FundingRequest,
  HistoricalCandleWindowRequest,
  MarketDataOperation,
  MarketDataRequestContext,
  OrderBookSnapshotObservation,
  OrderBookSnapshotRequest,
  PriceObservation,
  PriceRequest,
  RateObservation,
  RateRequest,
  TickerObservation,
  TickerRequest,
} from '../../../../../../packages/trading-contracts/src/index.js';
import { MarketDataBoundaryError } from '../../../../../../packages/trading-contracts/src/index.js';
import { assertHummingbotBaseline } from '../../../execution/providers/hummingbot/HummingbotDependencyBaseline.js';

interface HummingbotMarketDataClient {
  get_candles(venue: string, instrument: string, interval: string, maxRecords: number): Promise<unknown>;
  get_historical_candles(
    venue: string,
    instrument: string,
    interval: string,
    startTime?: number,
    endTime?: number,
  ): Promise<unknown>;
  get_prices(venue: string, instruments: string[]): Promise<unknown>;
  get_tickers(venue: string, refresh: boolean, maxAgeSeconds?: number): Promise<unknown>;
  get_rates(instrument: string, venue?: string): Promise<unknown>;
  get_funding_info(venue: string, instrument: string): Promise<unknown>;
  get_order_book(venue: string, instrument: string, depth: number): Promise<unknown>;
}

export interface HummingbotHttpMarketDataProviderOptions {
  client: HummingbotMarketDataClient;
  dependencyBaseline?: {
    condorRevision: string;
    apiClientRevision: string;
    apiClientVersion: string;
    apiServerRevision: string;
  };
  now?: () => Date;
}

export class HummingbotHttpMarketDataProvider implements AxodusMarketDataProvider {
  readonly id = 'hummingbot-http-market-data';

  private readonly client: HummingbotMarketDataClient;
  private readonly now: () => Date;

  constructor(options: HummingbotHttpMarketDataProviderOptions) {
    try {
      assertHummingbotBaseline(options.dependencyBaseline ?? defaultBaseline());
    } catch (error) {
      throw new MarketDataBoundaryError({
        code: 'MARKET_DATA_BASELINE_MISMATCH',
        operation: 'get-candle-window',
        message: error instanceof Error ? error.message : 'Hummingbot dependency baseline mismatch',
        retryable: false,
      });
    }
    this.client = options.client;
    this.now = options.now ?? (() => new Date());
  }

  async getCandleWindow(request: CandleWindowRequest): Promise<CandleWindowObservation> {
    validateCandleRequest(request, 'get-candle-window');
    return this.withFailure('get-candle-window', request.context, () =>
      this.client.get_candles(request.venue, request.instrument, request.interval, request.maxRecords)
    ).then((body) => normalizeCandles(body, request, 'current', this.now, 'get-candle-window'));
  }

  async getHistoricalCandleWindow(request: HistoricalCandleWindowRequest): Promise<CandleWindowObservation> {
    validateCandleRequest(request, 'get-historical-candle-window');
    return this.withFailure('get-historical-candle-window', request.context, () =>
      this.client.get_historical_candles(
        request.venue,
        request.instrument,
        request.interval,
        request.startTime,
        request.endTime,
      )
    ).then((body) => normalizeCandles(body, request, 'historical', this.now, 'get-historical-candle-window'));
  }

  async getPrices(request: PriceRequest): Promise<Record<string, PriceObservation>> {
    validateContext(request.context, 'get-prices');
    if (!request.venue || request.instruments.length === 0) {
      throw invalidRequest('get-prices', request.context, 'Venue and at least one instrument are required');
    }
    const body = await this.withFailure('get-prices', request.context, () =>
      this.client.get_prices(request.venue, request.instruments)
    );
    if (!isRecord(body) || !isRecord(body.prices)) {
      throw protocolFailure('get-prices', request.context, 'Hummingbot returned an invalid prices response');
    }
    const prices = body.prices;
    const sourceTimestamp = optionalEpochSecondsToIso(body.timestamp, 'get-prices');
    const observedAt = sourceTimestamp ?? this.now().toISOString();
    return Object.fromEntries(request.instruments.map((instrument: string) => {
      const price = prices[instrument];
      if (!isFiniteNumber(price)) {
        throw unavailable('get-prices', request.context, `Price unavailable for ${instrument}`);
      }
      return [instrument, {
        metadata: metadata(request.venue, instrument, observedAt, request.context, this.now, 'current', sourceTimestamp),
        price: decimal(price),
      } satisfies PriceObservation];
    }));
  }

  async getTickerSnapshot(request: TickerRequest): Promise<TickerObservation> {
    validateContext(request.context, 'get-ticker-snapshot');
    if (!request.venue || !request.instrument) {
      throw invalidRequest('get-ticker-snapshot', request.context, 'Venue and instrument are required');
    }
    const body = await this.withFailure('get-ticker-snapshot', request.context, () =>
      this.client.get_tickers(request.venue, request.refresh ?? false, request.maxAgeSeconds)
    );
    const ticker = isRecord(body) && isRecord(body.tickers)
      ? (() => {
        const venueTickers = body.tickers[request.venue];
        return isRecord(venueTickers) ? venueTickers[request.instrument] : undefined;
      })()
      : undefined;
    if (!isRecord(ticker) || !isFiniteNumber(ticker.price) || !isFiniteNumber(ticker.timestamp)) {
      throw unavailable('get-ticker-snapshot', request.context, `Ticker unavailable for ${request.venue}/${request.instrument}`);
    }
    return {
      metadata: metadata(request.venue, request.instrument, epochSecondsToIso(ticker.timestamp, 'get-ticker-snapshot'), request.context, this.now, 'current', epochSecondsToIso(ticker.timestamp, 'get-ticker-snapshot')),
      price: decimal(ticker.price),
      ...(isFiniteNumber(ticker.base_volume) ? { baseVolume: decimal(ticker.base_volume) } : {}),
      ...(isFiniteNumber(ticker.quote_volume) ? { quoteVolume: decimal(ticker.quote_volume) } : {}),
    };
  }

  async getRate(request: RateRequest): Promise<RateObservation> {
    validateContext(request.context, 'get-rates');
    if (!request.instrument) {
      throw invalidRequest('get-rates', request.context, 'Instrument is required');
    }
    const body = await this.withFailure('get-rates', request.context, () =>
      this.client.get_rates(request.instrument, request.venue)
    );
    const rate = isRecord(body) && isRecord(body.rates) ? body.rates[request.instrument] : undefined;
    if (!isFiniteNumber(rate)) {
      throw unavailable('get-rates', request.context, `Rate unavailable for ${request.instrument}`);
    }
    return {
      metadata: metadata(request.venue ?? 'market-data-pool', request.instrument, this.now().toISOString(), request.context, this.now, 'current'),
      price: decimal(rate),
      ...(isRecord(body) && typeof body.quote_token === 'string' ? { quoteToken: body.quote_token } : {}),
    };
  }

  async getFundingInfo(request: FundingRequest): Promise<FundingObservation> {
    validateContext(request.context, 'get-funding-info');
    if (!request.venue || !request.instrument) {
      throw invalidRequest('get-funding-info', request.context, 'Venue and instrument are required');
    }
    const body = await this.withFailure('get-funding-info', request.context, () =>
      this.client.get_funding_info(request.venue, request.instrument)
    );
    if (!isRecord(body) || typeof body.trading_pair !== 'string') {
      throw protocolFailure('get-funding-info', request.context, 'Hummingbot returned an invalid funding response');
    }
    return {
      metadata: metadata(request.venue, body.trading_pair, this.now().toISOString(), request.context, this.now, 'current'),
      ...(isFiniteNumber(body.funding_rate) ? { fundingRate: decimal(body.funding_rate) } : {}),
      ...(isFiniteNumber(body.next_funding_time) ? { nextFundingAt: epochSecondsToIso(body.next_funding_time, 'get-funding-info') } : {}),
      ...(isFiniteNumber(body.mark_price) ? { markPrice: decimal(body.mark_price) } : {}),
      ...(isFiniteNumber(body.index_price) ? { indexPrice: decimal(body.index_price) } : {}),
    };
  }

  async getOrderBookSnapshot(request: OrderBookSnapshotRequest): Promise<OrderBookSnapshotObservation> {
    validateContext(request.context, 'get-order-book-snapshot');
    if (!request.venue || !request.instrument || !Number.isInteger(request.depth) || request.depth < 1 || request.depth > 1000) {
      throw invalidRequest('get-order-book-snapshot', request.context, 'Venue, instrument and depth 1..1000 are required');
    }
    const body = await this.withFailure('get-order-book-snapshot', request.context, () =>
      this.client.get_order_book(request.venue, request.instrument, request.depth)
    );
    if (!isRecord(body) || typeof body.trading_pair !== 'string' || !Array.isArray(body.bids) || !Array.isArray(body.asks) || !isFiniteNumber(body.timestamp)) {
      throw protocolFailure('get-order-book-snapshot', request.context, 'Hummingbot returned an invalid order-book snapshot');
    }
    return {
      metadata: metadata(request.venue, body.trading_pair, epochSecondsToIso(body.timestamp, 'get-order-book-snapshot'), request.context, this.now, 'current', epochSecondsToIso(body.timestamp, 'get-order-book-snapshot')),
      depth: request.depth,
      bids: levels(body.bids, 'bids', request.context),
      asks: levels(body.asks, 'asks', request.context),
    };
  }

  private async withFailure<T>(operation: MarketDataOperation, context: MarketDataRequestContext, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof MarketDataBoundaryError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const timeout = /timeout|timed out|aborted/i.test(message);
      throw new MarketDataBoundaryError({
        code: timeout ? 'MARKET_DATA_TIMEOUT' : 'MARKET_DATA_TRANSPORT_FAILURE',
        operation,
        message: timeout ? 'Hummingbot market-data request timed out' : 'Hummingbot market-data transport failed',
        retryable: true,
      });
    }
  }
}

function defaultBaseline() {
  return {
    condorRevision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
    apiClientRevision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
    apiClientVersion: 'v1.5.9',
    apiServerRevision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
  };
}

function validateCandleRequest(request: CandleWindowRequest, operation: MarketDataOperation): void {
  validateContext(request.context, operation);
  if (!request.venue || !request.instrument || !request.interval || !Number.isInteger(request.maxRecords) || request.maxRecords < 1 || request.maxRecords > 5000) {
    throw invalidRequest(operation, request.context, 'Venue, instrument, interval and maxRecords 1..5000 are required');
  }
}

function validateContext(context: MarketDataRequestContext, operation: MarketDataOperation): void {
  if (!context?.correlationId) throw invalidRequest(operation, context, 'Correlation id is required');
}

function normalizeCandles(
  body: unknown,
  request: CandleWindowRequest,
  freshness: 'current' | 'historical',
  now: () => Date,
  operation: MarketDataOperation,
): CandleWindowObservation {
  const rows = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.candles) ? body.candles : undefined;
  if (!rows) throw protocolFailure(operation, request.context, 'Hummingbot returned an invalid candles response');
  const candles = rows.map((row) => {
    if (!isRecord(row) || !isFiniteNumber(row.open) || !isFiniteNumber(row.high) || !isFiniteNumber(row.low) || !isFiniteNumber(row.close) || !isFiniteNumber(row.volume)) {
      throw protocolFailure(operation, request.context, 'Hummingbot returned a malformed candle');
    }
    const sourceTimestamp = timestampToIso(row.timestamp, operation);
    return {
      metadata: metadata(request.venue, request.instrument, sourceTimestamp, request.context, now, freshness, sourceTimestamp),
      interval: request.interval,
      open: decimal(row.open), high: decimal(row.high), low: decimal(row.low), close: decimal(row.close), volume: decimal(row.volume),
    };
  });
  return {
    metadata: metadata(request.venue, request.instrument, candles.at(-1)?.metadata.sourceTimestamp ?? now().toISOString(), request.context, now, freshness, candles.at(-1)?.metadata.sourceTimestamp),
    interval: request.interval,
    candles,
  };
}

function levels(value: unknown[], side: string, context: MarketDataRequestContext) {
  return value.map((level) => {
    if (!Array.isArray(level) || level.length < 2 || !isFiniteNumber(level[0]) || !isFiniteNumber(level[1])) {
      throw protocolFailure('get-order-book-snapshot', context, `Malformed ${side} level`);
    }
    return { price: decimal(level[0]), amount: decimal(level[1]) };
  });
}

function metadata(
  venue: string,
  instrument: string,
  observedAt: string,
  context: MarketDataRequestContext,
  now: () => Date,
  freshness: 'current' | 'historical' | 'unknown',
  sourceTimestamp?: string,
) {
  return {
    venue,
    instrument,
    observedAt,
    ...(sourceTimestamp ? { sourceTimestamp } : {}),
    receivedAt: now().toISOString(),
    correlationId: context.correlationId,
    ...(context.sourceReference ? { sourceReference: context.sourceReference } : {}),
    freshness,
    continuous: false as const,
    lossless: false as const,
    sequenced: false as const,
    gapRecovered: false as const,
    replayable: false as const,
  };
}

function timestampToIso(value: unknown, operation: MarketDataOperation): string {
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  if (isFiniteNumber(value)) return epochSecondsToIso(value, operation);
  throw new MarketDataBoundaryError({
    code: 'MARKET_DATA_PROTOCOL_FAILURE',
    operation,
    message: 'Hummingbot returned a candle without a valid timestamp',
    retryable: false,
  });
}

function optionalEpochSecondsToIso(value: unknown, operation: MarketDataOperation): string | undefined {
  return isFiniteNumber(value) ? epochSecondsToIso(value, operation) : undefined;
}

function epochSecondsToIso(value: number, operation: MarketDataOperation): string {
  const millis = value > 10_000_000_000 ? value : value * 1000;
  const date = new Date(millis);
  if (Number.isNaN(date.valueOf())) {
    throw new MarketDataBoundaryError({
      code: 'MARKET_DATA_PROTOCOL_FAILURE',
      operation,
      message: 'Hummingbot returned an invalid source timestamp',
      retryable: false,
    });
  }
  return date.toISOString();
}

function decimal(value: number): string { return String(value); }
function isFiniteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

function invalidRequest(operation: MarketDataOperation, context: MarketDataRequestContext | undefined, message: string): MarketDataBoundaryError {
  return new MarketDataBoundaryError({ code: 'MARKET_DATA_INVALID_REQUEST', operation, message, retryable: false });
}
function unavailable(operation: MarketDataOperation, context: MarketDataRequestContext, message: string): MarketDataBoundaryError {
  return new MarketDataBoundaryError({ code: 'MARKET_DATA_UNAVAILABLE', operation, message, retryable: true });
}
function protocolFailure(operation: MarketDataOperation, context: MarketDataRequestContext, message: string): MarketDataBoundaryError {
  return new MarketDataBoundaryError({ code: 'MARKET_DATA_PROTOCOL_FAILURE', operation, message, retryable: false });
}
