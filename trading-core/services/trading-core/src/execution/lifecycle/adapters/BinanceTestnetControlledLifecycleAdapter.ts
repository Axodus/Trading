import type {
  ExecutionAttempt,
  ExecutionIntent,
  ProviderObservation,
} from '../../../../../../packages/trading-contracts/src/index.js';
import type { ControlledLifecycleAdapter } from './ControlledLifecycleAdapter.js';
import { assertVal04B1Environment } from '../../../external/Val04B1AuthenticatedReadHarness.js';
import { signVal04B2Query, VAL_04B2_BASE_URL } from '../../../external/Val04B2ControlledOrderHarness.js';

export interface BinanceTestnetAdapterConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  symbol?: string;
  timeoutMs?: number;
  suppressSubmissionAck?: boolean;
}

export class BinanceTestnetControlledLifecycleAdapter implements ControlledLifecycleAdapter {
  public readonly adapterType = 'binance_futures_testnet';
  private readonly baseUrl: string;
  private readonly symbol: string;
  private readonly timeoutMs: number;
  private suppressSubmissionAck: boolean;

  constructor(private readonly config: BinanceTestnetAdapterConfig) {
    this.baseUrl = config.baseUrl ?? VAL_04B2_BASE_URL;
    assertVal04B1Environment(this.baseUrl);
    this.symbol = config.symbol ?? 'BTCUSDT';
    this.timeoutMs = config.timeoutMs ?? 5000;
    this.suppressSubmissionAck = config.suppressSubmissionAck ?? false;
  }

  public setSuppressSubmissionAck(suppress: boolean): void {
    this.suppressSubmissionAck = suppress;
  }

  public async submitOrder(attempt: ExecutionAttempt, intent: ExecutionIntent): Promise<ProviderObservation> {
    assertVal04B1Environment(this.baseUrl);
    const now = Date.now().toString();

    const price = intent.constraints?.priceConstraints?.limitPrice ?? (intent.constraints as any)?.limitPrice ?? '50000.000000000000';
    const quantity = intent.executionQuantity;
    const side = (intent.side ?? 'buy').toUpperCase();

    const params: Record<string, string> = {
      symbol: this.symbol,
      side,
      type: 'LIMIT',
      timeInForce: 'GTC',
      quantity: Number(quantity).toString(),
      price: Number(price).toString(),
      newClientOrderId: attempt.clientOrderId,
      recvWindow: '5000',
      timestamp: now,
    };

    const signedParams = await signVal04B2Query(params, this.config.apiSecret);
    const url = new URL('/fapi/v1/order', this.baseUrl);
    for (const [k, v] of Object.entries(signedParams)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': this.config.apiKey,
      },
    });

    if (res.status !== 200) {
      const errJson = await res.json().catch(() => ({}));
      return {
        observationId: globalThis.crypto.randomUUID(),
        observationType: 'SUBMISSION_REJECT',
        provider: this.adapterType,
        venue: 'binance',
        clientOrderId: attempt.clientOrderId,
        providerStatus: 'REJECTED',
        source: 'rest-submission',
        observedAt: new Date().toISOString(),
        rawPayloadDigest: `digest-reject-${attempt.clientOrderId}-${JSON.stringify(errJson)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;

    // Fault injection hook: simulate network timeout / suppressed ACK after order is accepted by exchange
    if (this.suppressSubmissionAck) {
      throw new Error('ETIMEDOUT: Connection dropped after remote exchange accepted order (Simulated Ambiguous Submission).');
    }

    return {
      observationId: globalThis.crypto.randomUUID(),
      observationType: 'SUBMISSION_ACK',
      provider: this.adapterType,
      venue: 'binance',
      clientOrderId: attempt.clientOrderId,
      providerOrderId: String(data.orderId ?? ''),
      providerStatus: String(data.status ?? 'NEW'),
      observedQuantity: String(data.origQty ?? quantity),
      observedPrice: String(data.price ?? price),
      source: 'rest-submission',
      observedAt: new Date().toISOString(),
      providerTimestamp: data.updateTime ? new Date(Number(data.updateTime)).toISOString() : undefined,
      rawPayloadDigest: `digest-ack-${attempt.clientOrderId}-${data.orderId}`,
    };
  }

  public async queryOrder(clientOrderId: string, providerOrderId?: string): Promise<ProviderObservation> {
    assertVal04B1Environment(this.baseUrl);
    const now = Date.now().toString();

    const params: Record<string, string> = {
      symbol: this.symbol,
      recvWindow: '5000',
      timestamp: now,
    };
    if (providerOrderId) {
      params.orderId = providerOrderId;
    } else {
      params.origClientOrderId = clientOrderId;
    }

    const signedParams = await signVal04B2Query(params, this.config.apiSecret);
    const url = new URL('/fapi/v1/order', this.baseUrl);
    for (const [k, v] of Object.entries(signedParams)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.config.apiKey,
      },
    });

    if (res.status !== 200) {
      const errJson = await res.json().catch(() => ({}));
      return {
        observationId: globalThis.crypto.randomUUID(),
        observationType: 'ORDER_STATUS',
        provider: this.adapterType,
        venue: 'binance',
        clientOrderId,
        providerOrderId,
        providerStatus: 'NOT_FOUND',
        source: 'rest-query',
        observedAt: new Date().toISOString(),
        rawPayloadDigest: `digest-query-err-${clientOrderId}-${JSON.stringify(errJson)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;

    return {
      observationId: globalThis.crypto.randomUUID(),
      observationType: 'ORDER_STATUS',
      provider: this.adapterType,
      venue: 'binance',
      clientOrderId: String(data.clientOrderId ?? clientOrderId),
      providerOrderId: String(data.orderId ?? providerOrderId ?? ''),
      providerStatus: String(data.status ?? 'UNKNOWN'),
      observedQuantity: String(data.origQty ?? '0'),
      observedPrice: String(data.price ?? '0'),
      source: 'rest-query',
      observedAt: new Date().toISOString(),
      providerTimestamp: data.updateTime ? new Date(Number(data.updateTime)).toISOString() : undefined,
      rawPayloadDigest: `digest-query-${clientOrderId}-${data.orderId}-${data.status}`,
    };
  }

  public async cancelOrder(clientOrderId: string, providerOrderId?: string): Promise<ProviderObservation> {
    assertVal04B1Environment(this.baseUrl);
    const now = Date.now().toString();

    const params: Record<string, string> = {
      symbol: this.symbol,
      recvWindow: '5000',
      timestamp: now,
    };
    if (providerOrderId) {
      params.orderId = providerOrderId;
    } else {
      params.origClientOrderId = clientOrderId;
    }

    const signedParams = await signVal04B2Query(params, this.config.apiSecret);
    const url = new URL('/fapi/v1/order', this.baseUrl);
    for (const [k, v] of Object.entries(signedParams)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'X-MBX-APIKEY': this.config.apiKey,
      },
    });

    if (res.status !== 200) {
      const errJson = await res.json().catch(() => ({}));
      return {
        observationId: globalThis.crypto.randomUUID(),
        observationType: 'ERROR',
        provider: this.adapterType,
        venue: 'binance',
        clientOrderId,
        providerOrderId,
        providerStatus: 'CANCEL_FAILED',
        source: 'rest-cancellation',
        observedAt: new Date().toISOString(),
        rawPayloadDigest: `digest-cancel-err-${clientOrderId}-${JSON.stringify(errJson)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;

    return {
      observationId: globalThis.crypto.randomUUID(),
      observationType: 'CANCEL_ACK',
      provider: this.adapterType,
      venue: 'binance',
      clientOrderId: String(data.clientOrderId ?? clientOrderId),
      providerOrderId: String(data.orderId ?? providerOrderId ?? ''),
      providerStatus: String(data.status ?? 'CANCELED'),
      observedQuantity: String(data.origQty ?? '0'),
      observedPrice: String(data.price ?? '0'),
      source: 'rest-cancellation',
      observedAt: new Date().toISOString(),
      providerTimestamp: data.updateTime ? new Date(Number(data.updateTime)).toISOString() : undefined,
      rawPayloadDigest: `digest-cancel-${clientOrderId}-${data.orderId}-${data.status}`,
    };
  }

  public async queryFills(clientOrderId: string): Promise<ProviderObservation[]> {
    assertVal04B1Environment(this.baseUrl);
    const now = Date.now().toString();

    const params: Record<string, string> = {
      symbol: this.symbol,
      recvWindow: '5000',
      timestamp: now,
    };

    const signedParams = await signVal04B2Query(params, this.config.apiSecret);
    const url = new URL('/fapi/v1/userTrades', this.baseUrl);
    for (const [k, v] of Object.entries(signedParams)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.config.apiKey,
      },
    });

    if (res.status !== 200) {
      return [];
    }

    const trades = (await res.json()) as Array<Record<string, unknown>>;
    const observations: ProviderObservation[] = [];

    for (const t of trades) {
      const tradeId = String(t.id ?? '');
      observations.push({
        observationId: globalThis.crypto.randomUUID(),
        observationType: 'FILL',
        provider: this.adapterType,
        venue: 'binance',
        clientOrderId,
        providerOrderId: String(t.orderId ?? ''),
        providerTradeId: tradeId,
        observedQuantity: String(t.qty ?? '0'),
        observedPrice: String(t.price ?? '0'),
        observedFee: String(t.commission ?? '0'),
        observedFeeAsset: String(t.commissionAsset ?? 'USDT'),
        source: 'rest-query',
        observedAt: new Date().toISOString(),
        providerTimestamp: t.time ? new Date(Number(t.time)).toISOString() : undefined,
        rawPayloadDigest: `digest-trade-${tradeId}`,
      });
    }

    return observations;
  }
}
