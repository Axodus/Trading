import type {
  CandleObservation,
  FundingObservation,
  MarketObservation,
  MarketObservationQuality,
  OrderBookSnapshotObservation,
  PriceObservation,
  TickerObservation,
} from '../../../../packages/trading-contracts/src/index.js';

export interface NormalizableMarketObservation {
  observationId?: string;
  observationType: MarketObservation['observationType'];
  instrument: string;
  venue: string;
  eventTime?: string;
  observedAt: string;
  receivedAt: string;
  value: Readonly<Record<string, unknown>>;
  sourceRef?: string;
  schemaVersion?: string;
  quality?: MarketObservationQuality;
  sequence?: number;
  sequenceScope?: string;
  reconnectBoundary?: boolean;
}

export interface DeduplicatedObservations {
  observations: readonly MarketObservation[];
  duplicateObservationIds: readonly string[];
  conflictingObservationIds: readonly string[];
}

export class MarketObservationNormalizer {
  normalize(input: NormalizableMarketObservation): MarketObservation {
    const eventTime = input.eventTime ?? input.observedAt;
    const observationId = input.observationId ?? `${input.venue}:${input.instrument}:${input.observationType}:${eventTime}`;
    return {
      observationId,
      instrument: input.instrument,
      venue: input.venue,
      observationType: input.observationType,
      eventTime,
      observedAt: input.observedAt,
      receivedAt: input.receivedAt,
      value: input.value,
      sourceRef: input.sourceRef ?? observationId,
      schemaVersion: input.schemaVersion ?? '1.0.0',
      quality: input.quality ?? 'valid',
      sequence: input.sequence,
      sequenceScope: input.sequenceScope,
      reconnectBoundary: input.reconnectBoundary,
    };
  }

  deduplicate(observations: readonly MarketObservation[]): DeduplicatedObservations {
    const byId = new Map<string, MarketObservation>();
    const duplicates: string[] = [];
    const conflicts: string[] = [];
    for (const observation of observations) {
      const previous = byId.get(observation.observationId);
      if (!previous) {
        byId.set(observation.observationId, observation);
        continue;
      }
      duplicates.push(observation.observationId);
      if (stableValue(previous.value) !== stableValue(observation.value)) conflicts.push(observation.observationId);
    }
    return {
      observations: [...byId.values()].sort((left, right) => left.observationId.localeCompare(right.observationId)),
      duplicateObservationIds: [...new Set(duplicates)].sort(),
      conflictingObservationIds: [...new Set(conflicts)].sort(),
    };
  }

  fromTicker(observation: TickerObservation): MarketObservation {
    return this.normalize({
      observationType: 'ticker',
      instrument: observation.metadata.instrument,
      venue: observation.metadata.venue,
      eventTime: observation.metadata.sourceTimestamp ?? observation.metadata.observedAt,
      observedAt: observation.metadata.observedAt,
      receivedAt: observation.metadata.receivedAt,
      value: { price: observation.price, baseVolume: observation.baseVolume, quoteVolume: observation.quoteVolume },
      sourceRef: observation.metadata.sourceReference,
      quality: observation.metadata.freshness === 'current' ? 'valid' : observation.metadata.freshness === 'historical' ? 'valid' : 'unknown',
    });
  }

  fromPrice(observation: PriceObservation): MarketObservation {
    return this.normalize({
      observationType: 'ticker', instrument: observation.metadata.instrument, venue: observation.metadata.venue,
      eventTime: observation.metadata.sourceTimestamp ?? observation.metadata.observedAt,
      observedAt: observation.metadata.observedAt, receivedAt: observation.metadata.receivedAt,
      value: { price: observation.price }, sourceRef: observation.metadata.sourceReference,
      quality: observation.metadata.freshness === 'unknown' ? 'unknown' : 'valid',
    });
  }

  fromCandle(observation: CandleObservation): MarketObservation {
    return this.normalize({
      observationType: 'candle', instrument: observation.metadata.instrument, venue: observation.metadata.venue,
      eventTime: observation.metadata.sourceTimestamp ?? observation.metadata.observedAt,
      observedAt: observation.metadata.observedAt, receivedAt: observation.metadata.receivedAt,
      value: { interval: observation.interval, open: observation.open, high: observation.high, low: observation.low, close: observation.close, volume: observation.volume },
      sourceRef: observation.metadata.sourceReference,
      quality: observation.metadata.freshness === 'unknown' ? 'unknown' : 'valid',
    });
  }

  fromFunding(observation: FundingObservation): MarketObservation {
    return this.normalize({
      observationType: 'funding', instrument: observation.metadata.instrument, venue: observation.metadata.venue,
      eventTime: observation.metadata.sourceTimestamp ?? observation.metadata.observedAt,
      observedAt: observation.metadata.observedAt, receivedAt: observation.metadata.receivedAt,
      value: { fundingRate: observation.fundingRate, nextFundingAt: observation.nextFundingAt, markPrice: observation.markPrice, indexPrice: observation.indexPrice },
      sourceRef: observation.metadata.sourceReference,
      quality: observation.metadata.freshness === 'unknown' ? 'unknown' : 'valid',
    });
  }

  fromOrderBook(observation: OrderBookSnapshotObservation): MarketObservation {
    return this.normalize({
      observationType: 'order-book', instrument: observation.metadata.instrument, venue: observation.metadata.venue,
      eventTime: observation.metadata.sourceTimestamp ?? observation.metadata.observedAt,
      observedAt: observation.metadata.observedAt, receivedAt: observation.metadata.receivedAt,
      value: { depth: observation.depth, bids: observation.bids, asks: observation.asks },
      sourceRef: observation.metadata.sourceReference,
      quality: observation.metadata.freshness === 'unknown' ? 'unknown' : 'valid',
    });
  }
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableValue((value as Record<string, unknown>)[key])}`).join(',')}}`;
}
