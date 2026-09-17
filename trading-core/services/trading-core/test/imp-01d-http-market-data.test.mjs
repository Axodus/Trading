import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HummingbotHttpMarketDataProvider,
} from '../../../../dist-test/trading-core/services/trading-core/src/index.js';
import { MarketDataBoundaryError } from '../../../../dist-test/trading-core/packages/trading-contracts/src/index.js';

const baseline = {
  condorRevision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
  apiClientRevision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
  apiClientVersion: 'v1.5.9',
  apiServerRevision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
};

const now = () => new Date('2026-09-17T12:00:00.000Z');

function context(sourceReference = 'fixture:imp-01d') {
  return { correlationId: 'corr-01d-1', sourceReference };
}

function provider(client, dependencyBaseline = baseline) {
  return new HummingbotHttpMarketDataProvider({ client, dependencyBaseline, now });
}

describe('IMP-01D HTTP market-data boundary', () => {
  it('normalizes candles into Axodus observations with source and receipt timestamps', async () => {
    const result = await provider({
      get_candles: async () => [{ timestamp: '2025-09-17T12:00:00.000Z', open: 100, high: 101, low: 99, close: 100.5, volume: 12 }],
      get_historical_candles: async () => [],
      get_prices: async () => ({}),
      get_tickers: async () => ({}),
      get_rates: async () => ({}),
      get_funding_info: async () => ({}),
      get_order_book: async () => ({}),
    }).getCandleWindow({ venue: 'binance', instrument: 'BTC-USDT', interval: '1m', maxRecords: 1, context: context() });

    assert.equal(result.candles[0].close, '100.5');
    assert.equal(result.candles[0].metadata.sourceTimestamp, '2025-09-17T12:00:00.000Z');
    assert.equal(result.candles[0].metadata.receivedAt, '2026-09-17T12:00:00.000Z');
    assert.equal(result.metadata.candles, undefined);
    assert.equal(result.metadata.continuous, false);
    assert.equal(result.metadata.lossless, false);
    assert.equal(result.metadata.sequenced, false);
    assert.equal(result.metadata.gapRecovered, false);
    assert.equal(result.metadata.replayable, false);
  });

  it('normalizes historical candles without claiming live or replayable semantics', async () => {
    const result = await provider({
      get_candles: async () => [],
      get_historical_candles: async () => [{ timestamp: '2025-09-17T12:00:00.000Z', open: 1, high: 2, low: 0.5, close: 1.5, volume: 4 }],
      get_prices: async () => ({}), get_tickers: async () => ({}), get_rates: async () => ({}),
      get_funding_info: async () => ({}), get_order_book: async () => ({}),
    }).getHistoricalCandleWindow({ venue: 'binance', instrument: 'BTC-USDT', interval: '1m', maxRecords: 1, context: context('fixture:historical') });

    assert.equal(result.metadata.freshness, 'historical');
    assert.equal(result.candles[0].metadata.freshness, 'historical');
    assert.equal(result.metadata.replayable, false);
  });

  it('normalizes prices and tickers while keeping upstream fields out of the contract', async () => {
    const client = {
      get_candles: async () => [], get_historical_candles: async () => [],
      get_prices: async () => ({ prices: { 'BTC-USDT': 101.25 }, timestamp: 1758110400 }),
      get_tickers: async () => ({ tickers: { binance: { 'BTC-USDT': { price: 101.5, base_volume: 4, quote_volume: 406, timestamp: 1758110400 } } } }),
      get_rates: async () => ({}), get_funding_info: async () => ({}), get_order_book: async () => ({}),
    };
    const instance = provider(client);
    const prices = await instance.getPrices({ venue: 'binance', instruments: ['BTC-USDT'], context: context() });
    const ticker = await instance.getTickerSnapshot({ venue: 'binance', instrument: 'BTC-USDT', context: context() });

    assert.deepEqual(prices['BTC-USDT'].price, '101.25');
    assert.equal(Object.hasOwn(prices['BTC-USDT'], 'prices'), false);
    assert.deepEqual(ticker, {
      metadata: {
        venue: 'binance', instrument: 'BTC-USDT', observedAt: '2025-09-17T12:00:00.000Z',
        sourceTimestamp: '2025-09-17T12:00:00.000Z', receivedAt: '2026-09-17T12:00:00.000Z',
        correlationId: 'corr-01d-1', sourceReference: 'fixture:imp-01d', freshness: 'current',
        continuous: false, lossless: false, sequenced: false, gapRecovered: false, replayable: false,
      },
      price: '101.5', baseVolume: '4', quoteVolume: '406',
    });
  });

  it('normalizes order-book snapshots and does not expose stream semantics', async () => {
    const instance = provider({
      get_candles: async () => [], get_historical_candles: async () => [], get_prices: async () => ({}),
      get_tickers: async () => ({}), get_rates: async () => ({}), get_funding_info: async () => ({}),
      get_order_book: async () => ({ trading_pair: 'BTC-USDT', bids: [[100, 2]], asks: [[101, 3]], timestamp: 1758110400 }),
    });
    const result = await instance.getOrderBookSnapshot({ venue: 'binance', instrument: 'BTC-USDT', depth: 10, context: context() });

    assert.deepEqual(result.bids, [{ price: '100', amount: '2' }]);
    assert.deepEqual(result.asks, [{ price: '101', amount: '3' }]);
    assert.equal(result.metadata.sequenced, false);
    assert.equal('getOrderBookUpdates' in instance, false);
    assert.equal('getTrades' in instance, false);
    assert.equal('connectWebSocket' in instance, false);
  });

  it('maps malformed upstream data to a typed protocol failure without leaking details', async () => {
    const instance = provider({
      get_candles: async () => [{ timestamp: '2025-09-17T12:00:00.000Z', open: 'bad', high: 1, low: 1, close: 1, volume: 1 }],
      get_historical_candles: async () => [], get_prices: async () => ({}), get_tickers: async () => ({}),
      get_rates: async () => ({}), get_funding_info: async () => ({}), get_order_book: async () => ({}),
    });
    await assert.rejects(
      () => instance.getCandleWindow({ venue: 'binance', instrument: 'BTC-USDT', interval: '1m', maxRecords: 1, context: context() }),
      (error) => error instanceof MarketDataBoundaryError
        && error.failure.code === 'MARKET_DATA_PROTOCOL_FAILURE'
        && !Object.hasOwn(error.failure, 'detail'),
    );
  });

  it('maps timeout and transport failures to typed Axodus failures', async () => {
    const makeClient = (error) => ({
      get_candles: async () => { throw error; }, get_historical_candles: async () => [], get_prices: async () => ({}),
      get_tickers: async () => ({}), get_rates: async () => ({}), get_funding_info: async () => ({}), get_order_book: async () => ({}),
    });
    for (const [error, code] of [[new Error('request timed out'), 'MARKET_DATA_TIMEOUT'], [new Error('socket closed'), 'MARKET_DATA_TRANSPORT_FAILURE']]) {
      await assert.rejects(
        () => provider(makeClient(error)).getCandleWindow({ venue: 'binance', instrument: 'BTC-USDT', interval: '1m', maxRecords: 1, context: context() }),
        (failure) => failure instanceof MarketDataBoundaryError && failure.failure.code === code && failure.failure.retryable === true,
      );
    }
  });

  it('rejects baseline drift and invalid capabilities before any HTTP call', async () => {
    let called = false;
    const client = {
      get_candles: async () => { called = true; return []; }, get_historical_candles: async () => [], get_prices: async () => ({}),
      get_tickers: async () => ({}), get_rates: async () => ({}), get_funding_info: async () => ({}), get_order_book: async () => ({}),
    };
    assert.throws(
      () => provider(client, { ...baseline, apiClientVersion: 'v-next' }),
      (error) => error instanceof MarketDataBoundaryError && error.failure.code === 'MARKET_DATA_BASELINE_MISMATCH',
    );
    const instance = provider(client);
    await assert.rejects(
      () => instance.getOrderBookSnapshot({ venue: 'binance', instrument: 'BTC-USDT', depth: 0, context: context() }),
      (error) => error instanceof MarketDataBoundaryError && error.failure.code === 'MARKET_DATA_INVALID_REQUEST',
    );
    assert.equal(called, false);
  });
});
