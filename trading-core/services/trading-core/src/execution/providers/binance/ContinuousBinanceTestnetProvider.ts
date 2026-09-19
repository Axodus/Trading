import type {
  CexConnectorCapabilities,
  CexOrderEvidence,
  CexReconciliationProvider,
  CexReconciliationRequest,
  CexReconciliationResult,
} from '../../../../../../packages/trading-contracts/src/index.js';
import type { Val04B1CredentialSource } from '../../../external/Val04B1AuthenticatedReadHarness.js';
import {
  deriveRuntimeVenueRules,
  type BinanceExchangeInfo,
  type RuntimeVenueRules,
} from '../../../external/Val04BPreCredentialHarness.js';
import {
  VAL_04B2_BASE_URL,
  VAL_04B2_EXCHANGE_INFO_PATH,
  VAL_04B2_OPEN_ORDERS_PATH,
  VAL_04B2_ORDER_PATH,
  VAL_04B2_POSITION_RISK_PATH,
  VAL_04B2_PREMIUM_INDEX_PATH,
  type Val04B2HttpResponse,
  type Val04B2Transport,
  signVal04B2Query,
} from '../../../external/Val04B2ControlledOrderHarness.js';
import type {
  ContinuousPositionProvider,
  ContinuousPositionRecord,
} from '../../continuous/ContinuousPositionReconciliationService.js';
import type {
  ContinuousVenueMutationProvider,
  ContinuousVenueOrderMutationRequest,
  ContinuousVenueOrderMutationResponse,
} from '../../continuous/ContinuousExecutionRuntime.js';
import type { DurableCexCancellationProvider } from '../../DurableCexExecutionLifecycleService.js';

export const CONTINUOUS_BINANCE_TESTNET_PROVIDER_ID = 'binance-perpetual-testnet' as const;
export const CONTINUOUS_BINANCE_TESTNET_CONNECTOR = 'binance-futures-testnet' as const;

export interface ContinuousBinanceTestnetVenueSnapshot {
  rules: RuntimeVenueRules;
  referencePrice: number;
  observedAt: string;
}

export interface ContinuousBinanceTestnetOpenOrder {
  symbol: string;
  orderId: string;
  clientOrderId: string;
  status: string;
  side: 'buy' | 'sell';
  type: string;
  origQty: string;
  executedQty: string;
  price: string;
}

export class ContinuousBinanceProviderRejectedError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Binance Testnet provider rejected request with HTTP ${status}`);
    this.name = 'ContinuousBinanceProviderRejectedError';
  }
}

function assertContinuousTestnetUrl(baseUrl: string): URL {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' || parsed.origin !== VAL_04B2_BASE_URL) {
    throw new Error('Continuous provider admits only https://testnet.binancefuture.com');
  }
  return parsed;
}

function toRecord(body: unknown, label: string): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(`${label} response is not an object`);
  return body as Record<string, unknown>;
}

async function bodyOf(response: Val04B2HttpResponse): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export class ContinuousBinanceTestnetProvider
  implements ContinuousVenueMutationProvider, CexReconciliationProvider, DurableCexCancellationProvider, ContinuousPositionProvider {
  readonly providerId = CONTINUOUS_BINANCE_TESTNET_PROVIDER_ID;
  readonly connector = CONTINUOUS_BINANCE_TESTNET_CONNECTOR;
  readonly capabilities: CexConnectorCapabilities = {
    supportsCallerOrderIdentity: true,
    supportsExactOrderLookup: true,
    supportsDeterministicReconciliation: true,
  };

  constructor(
    private readonly credentialSource: Val04B1CredentialSource | undefined,
    private readonly transport: Val04B2Transport,
    private readonly baseUrl = VAL_04B2_BASE_URL,
    private readonly timeoutMs = 5000,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    assertContinuousTestnetUrl(baseUrl);
  }

  async getVenueSnapshot(): Promise<ContinuousBinanceTestnetVenueSnapshot> {
    const exchangeInfoResponse = await this.transport.get(`${this.baseUrl}${VAL_04B2_EXCHANGE_INFO_PATH}`, {}, {}, this.timeoutMs);
    if (exchangeInfoResponse.status !== 200) throw new Error(`Binance exchangeInfo failed with HTTP ${exchangeInfoResponse.status}`);
    const exchangeInfo = (await bodyOf(exchangeInfoResponse)) as BinanceExchangeInfo;
    const rules = deriveRuntimeVenueRules(exchangeInfo);

    const priceResponse = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_PREMIUM_INDEX_PATH}`,
      { symbol: rules.symbol },
      {},
      this.timeoutMs,
    );
    if (priceResponse.status !== 200) throw new Error(`Binance premiumIndex failed with HTTP ${priceResponse.status}`);
    const priceBody = toRecord(await bodyOf(priceResponse), 'premiumIndex');
    const referencePrice = Number(priceBody.markPrice ?? priceBody.price);
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) throw new Error('Binance reference price is invalid');
    return { rules, referencePrice, observedAt: this.now() };
  }

  async submitOrder(request: ContinuousVenueOrderMutationRequest): Promise<ContinuousVenueOrderMutationResponse> {
    const material = await this.material();
    const params = await signVal04B2Query({
      symbol: request.symbol,
      side: request.side.toUpperCase(),
      type: request.orderType.toUpperCase(),
      ...(request.orderType === 'limit' ? { timeInForce: 'GTC' } : {}),
      quantity: request.quantity,
      ...(request.price ? { price: request.price } : {}),
      newClientOrderId: request.executionClientOrderId,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    }, material.apiSecret);
    const response = await this.transport.post(`${this.baseUrl}${VAL_04B2_ORDER_PATH}`, params, { 'X-MBX-APIKEY': material.apiKey }, this.timeoutMs);
    const body = await bodyOf(response);
    if (response.status < 200 || response.status >= 300) throw new ContinuousBinanceProviderRejectedError(response.status, body);
    const record = toRecord(body, 'order submission');
    const providerOrderId = String(record.orderId ?? '');
    const clientOrderId = String(record.clientOrderId ?? record.origClientOrderId ?? '');
    if (!providerOrderId || clientOrderId !== request.executionClientOrderId) throw new Error('Binance submission response did not preserve execution identity');
    return {
      providerOrderId,
      providerStatus: String(record.status ?? 'UNKNOWN'),
      filledQuantity: String(record.executedQty ?? '0'),
      remainingQuantity: String(record.origQty !== undefined && record.executedQty !== undefined ? Number(record.origQty) - Number(record.executedQty) : request.quantity),
      raw: record,
    };
  }

  async reconcileByClientOrderId(request: CexReconciliationRequest): Promise<CexReconciliationResult> {
    try {
      const response = await this.privateRequest('GET', VAL_04B2_ORDER_PATH, {
        symbol: request.market,
        origClientOrderId: request.executionClientOrderId,
      });
      const body = await bodyOf(response);
      if (response.status === 404 || (response.status >= 400 && String((body as Record<string, unknown>)?.code) === '-2013')) {
        return { outcome: 'not-found', observedAt: this.now() };
      }
      if (response.status < 200 || response.status >= 300) return { outcome: 'indeterminate', reason: `Exact lookup failed with HTTP ${response.status}`, observedAt: this.now() };
      const evidence = this.toEvidence(toRecord(body, 'exact order lookup'), request.executionClientOrderId, 'rest-exact-lookup');
      return { outcome: 'found', evidence };
    } catch (error) {
      return { outcome: 'indeterminate', reason: error instanceof Error ? error.message : String(error), observedAt: this.now() };
    }
  }

  async cancelByProviderOrderId(request: Parameters<DurableCexCancellationProvider['cancelByProviderOrderId']>[0]): Promise<{ outcome: 'cancelled' | 'rejected'; evidence?: CexOrderEvidence; reason?: string }> {
    const material = await this.material();
    const params = await signVal04B2Query({
      symbol: request.market,
      orderId: request.providerOrderId,
      origClientOrderId: request.executionClientOrderId,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    }, material.apiSecret);
    let response: Val04B2HttpResponse;
    try {
      response = await this.transport.delete(`${this.baseUrl}${VAL_04B2_ORDER_PATH}`, params, { 'X-MBX-APIKEY': material.apiKey }, this.timeoutMs);
    } catch (error) {
      throw error;
    }
    const body = await bodyOf(response);
    if (response.status < 200 || response.status >= 300) return { outcome: 'rejected', reason: `Cancellation rejected with HTTP ${response.status}: ${JSON.stringify(body)}` };
    const record = toRecord(body, 'cancellation');
    return { outcome: 'cancelled', evidence: this.toEvidence(record, request.executionClientOrderId, 'rest-cancellation-response', 'cancelled') };
  }

  async getOpenOrders(symbol = 'BTCUSDT'): Promise<ContinuousBinanceTestnetOpenOrder[]> {
    const response = await this.privateRequest('GET', VAL_04B2_OPEN_ORDERS_PATH, { symbol });
    const body = await bodyOf(response);
    if (response.status < 200 || response.status >= 300) throw new Error(`Binance open orders failed with HTTP ${response.status}`);
    if (!Array.isArray(body)) throw new Error('Binance open orders response is not an array');
    return body.map((item) => {
      const record = toRecord(item, 'open order');
      return {
        symbol: String(record.symbol), orderId: String(record.orderId), clientOrderId: String(record.clientOrderId),
        status: String(record.status), side: String(record.side).toLowerCase() as 'buy' | 'sell', type: String(record.type),
        origQty: String(record.origQty), executedQty: String(record.executedQty ?? '0'), price: String(record.price ?? '0'),
      };
    });
  }

  async getPositions(market = 'BTCUSDT'): Promise<ContinuousPositionRecord[]> {
    const response = await this.privateRequest('GET', VAL_04B2_POSITION_RISK_PATH, { symbol: market });
    const body = await bodyOf(response);
    if (response.status < 200 || response.status >= 300) throw new Error(`Binance position risk failed with HTTP ${response.status}`);
    if (!Array.isArray(body)) throw new Error('Binance position response is not an array');
    return body.flatMap((item) => {
      const record = toRecord(item, 'position');
      const quantity = Number(record.positionAmt ?? '0');
      if (!Number.isFinite(quantity) || quantity === 0) return [];
      const rawSide = String(record.positionSide ?? 'BOTH').toLowerCase();
      const side = rawSide === 'long' || rawSide === 'short' ? rawSide : quantity >= 0 ? 'long' : 'short';
      return [{
        market: String(record.symbol), symbol: String(record.symbol), side: side as 'long' | 'short', quantity: String(Math.abs(quantity)),
        entryPrice: record.entryPrice === undefined ? undefined : String(record.entryPrice),
        unrealizedPnl: record.unRealizedProfit === undefined ? undefined : String(record.unRealizedProfit), updatedAt: this.now(),
      }];
    });
  }

  private async material(): Promise<{ apiKey: string; apiSecret: string }> {
    if (!this.credentialSource) throw new Error('Authenticated Binance Testnet credential source is not configured');
    return this.credentialSource.resolveEphemeralMaterial();
  }

  private async privateRequest(method: 'GET', path: string, query: Record<string, string>): Promise<Val04B2HttpResponse> {
    const material = await this.material();
    const signed = await signVal04B2Query({ ...query, recvWindow: '5000', timestamp: String(Date.now()) }, material.apiSecret);
    return this.transport.get(`${this.baseUrl}${path}`, signed, { 'X-MBX-APIKEY': material.apiKey }, this.timeoutMs);
  }

  private toEvidence(record: Record<string, unknown>, executionClientOrderId: string, source: CexOrderEvidence['source'], cancellationState: CexOrderEvidence['cancellationState'] = 'not-requested'): CexOrderEvidence {
    const returnedClientOrderId = String(record.clientOrderId ?? record.origClientOrderId ?? '');
    if (returnedClientOrderId !== executionClientOrderId) throw new Error('Binance order evidence identity mismatch');
    return {
      executionClientOrderId,
      providerOrderId: record.orderId === undefined ? undefined : String(record.orderId),
      providerStatus: String(record.status ?? 'UNKNOWN'),
      filledQuantity: record.executedQty === undefined ? undefined : String(record.executedQty),
      remainingQuantity: record.origQty !== undefined && record.executedQty !== undefined ? String(Number(record.origQty) - Number(record.executedQty)) : undefined,
      observedAt: this.now(), source, cancellationState,
    };
  }
}
