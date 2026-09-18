import {
  deriveMinimumValidLimitOrder,
  deriveRuntimeVenueRules,
  BinanceExchangeInfo,
  VAL_04B_AXODUS_INSTRUMENT,
  VAL_04B_ENVIRONMENT,
  VAL_04B_SYMBOL,
} from './Val04BPreCredentialHarness.js';
import {
  assertVal04B1CredentialMetadata,
  assertVal04B1Environment,
  Val04B1CredentialSource,
} from './Val04B1AuthenticatedReadHarness.js';
import { TradingExternalSafetyPreflightPolicy } from '../security/TradingExternalSafetyPreflightPolicy.js';

export const VAL_04B2_BASE_URL = 'https://testnet.binancefuture.com' as const;
export const VAL_04B2_ENVIRONMENT = VAL_04B_ENVIRONMENT;
export const VAL_04B2_SYMBOL = VAL_04B_SYMBOL;
export const VAL_04B2_INSTRUMENT = VAL_04B_AXODUS_INSTRUMENT;
export const VAL_04B2_APPROVAL_TOKEN = 'VAL-04B-EXTERNAL-EXECUTION-APPROVED' as const;

export const VAL_04B2_EXCHANGE_INFO_PATH = '/fapi/v1/exchangeInfo' as const;
export const VAL_04B2_PREMIUM_INDEX_PATH = '/fapi/v1/premiumIndex' as const;
export const VAL_04B2_ORDER_PATH = '/fapi/v1/order' as const;
export const VAL_04B2_OPEN_ORDERS_PATH = '/fapi/v1/openOrders' as const;
export const VAL_04B2_POSITION_RISK_PATH = '/fapi/v2/positionRisk' as const;

export interface Val04B2HttpResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface Val04B2Transport {
  get(
    url: string,
    query?: Readonly<Record<string, string>>,
    headers?: Readonly<Record<string, string>>,
    timeoutMs?: number,
  ): Promise<Val04B2HttpResponse>;
  post(
    url: string,
    query?: Readonly<Record<string, string>>,
    headers?: Readonly<Record<string, string>>,
    timeoutMs?: number,
  ): Promise<Val04B2HttpResponse>;
  delete(
    url: string,
    query?: Readonly<Record<string, string>>,
    headers?: Readonly<Record<string, string>>,
    timeoutMs?: number,
  ): Promise<Val04B2HttpResponse>;
}

export interface Val04B2ExecutionOptions {
  approval: typeof VAL_04B2_APPROVAL_TOKEN;
  priceDiscountFactor?: number;
  maxOrderNotional?: number;
  tenantId?: string;
  runSessionId?: string;
}

export interface Val04B2OrderExecutionResult {
  environment: typeof VAL_04B2_ENVIRONMENT;
  symbol: typeof VAL_04B2_SYMBOL;
  instrument: typeof VAL_04B2_INSTRUMENT;
  executionClientOrderId: string;
  providerOrderId?: string | number;
  submittedPrice: number;
  submittedQuantity: number;
  submittedNotional: number;
  preflightPassed: boolean;
  submissionStatus: string;
  lookupStatusAfterSubmit: string;
  identityPreserved: boolean;
  cancellationStatus: string;
  terminalReconciliationStatus: string;
  residualActiveOrdersCount: number;
  residualPositionAmount: number;
  blindRetries: number;
  ordersSubmitted: number;
  websocketUsed: false;
  mainnetExcluded: true;
  secretsExposed: false;
  cleanupPassed: boolean;
}

export class Val04B2BoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Val04B2BoundaryError';
  }
}

export async function signVal04B2Query(
  params: Readonly<Record<string, string>>,
  apiSecret: string,
): Promise<Record<string, string>> {
  const searchParams = new URLSearchParams(params);
  const payload = searchParams.toString();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await globalThis.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const signature = Array.from(new Uint8Array(signatureBytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { ...params, signature };
}

export function generateVal04B2ClientOrderId(timestamp: number = Date.now()): string {
  const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const id = `axd_v04b2_${timestamp}_${randomSuffix}`;
  if (id.length > 32) {
    return id.slice(0, 32);
  }
  return id;
}

export class Val04B2ControlledOrderHarness {
  private readonly preflightPolicy = new TradingExternalSafetyPreflightPolicy();

  constructor(
    private readonly source: Val04B1CredentialSource,
    private readonly transport: Val04B2Transport,
    private readonly baseUrl: string = VAL_04B2_BASE_URL,
    private readonly timeoutMs: number = 5000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async executeControlledOrderLifecycle(
    options: Val04B2ExecutionOptions,
  ): Promise<Val04B2OrderExecutionResult> {
    // 1. Fail-closed gate verification
    if (!options || options.approval !== VAL_04B2_APPROVAL_TOKEN) {
      throw new Val04B2BoundaryError(
        'VAL-04B2 execution gate is CLOSED. Explicit approval token VAL-04B-EXTERNAL-EXECUTION-APPROVED is required.',
      );
    }

    // 2. Environment & URL assertion
    assertVal04B1Environment(this.baseUrl);

    // 3. Credential validation (scopes, provider, metadata)
    const metadata = this.source.metadata();
    assertVal04B1CredentialMetadata(metadata);
    const material = await this.source.resolveEphemeralMaterial();
    if (!material.apiKey || !material.apiSecret) {
      throw new Val04B2BoundaryError('Credential material is incomplete');
    }

    // 4. Fetch public exchangeInfo
    const exchangeInfoRes = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_EXCHANGE_INFO_PATH}`,
      {},
      {},
      this.timeoutMs,
    );
    if (exchangeInfoRes.status !== 200) {
      throw new Val04B2BoundaryError(`Failed to fetch public exchangeInfo: HTTP ${exchangeInfoRes.status}`);
    }
    const exchangeInfo = (await exchangeInfoRes.json()) as BinanceExchangeInfo;
    const venueRules = deriveRuntimeVenueRules(exchangeInfo);

    // 5. Fetch reference market/mark price
    const premiumIndexRes = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_PREMIUM_INDEX_PATH}`,
      { symbol: VAL_04B2_SYMBOL },
      {},
      this.timeoutMs,
    );
    if (premiumIndexRes.status !== 200) {
      throw new Val04B2BoundaryError(`Failed to fetch premiumIndex: HTTP ${premiumIndexRes.status}`);
    }
    const premiumIndexJson = (await premiumIndexRes.json()) as Record<string, unknown>;
    const rawMarkPrice = premiumIndexJson.markPrice ?? premiumIndexJson.price;
    const referencePrice = Number(rawMarkPrice);
    if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
      throw new Val04B2BoundaryError(`Invalid reference price obtained: ${String(rawMarkPrice)}`);
    }

    // 6. Calculate conservative LIMIT price (default 20% below market to avoid intentional fills)
    const discount = options.priceDiscountFactor ?? 0.8;
    const targetPrice = referencePrice * discount;

    // 7. Generate executionClientOrderId (length <= 32)
    const executionClientOrderId = generateVal04B2ClientOrderId(this.now());
    if (executionClientOrderId.length > 32) {
      throw new Val04B2BoundaryError(`Generated clientOrderId exceeds 32 chars: ${executionClientOrderId}`);
    }

    // 8. Derive minimum valid LIMIT order adhering to venue rules and Axodus hard ceiling
    const maxOrderNotional = options.maxOrderNotional ?? 250;
    const preparedOrder = deriveMinimumValidLimitOrder(
      venueRules,
      targetPrice,
      maxOrderNotional,
      executionClientOrderId,
      'BUY',
    );

    // 9. Axodus Safety Preflight
    const tenantId = options.tenantId ?? 'axodus-trading-tenant';
    const runSessionId = options.runSessionId ?? 'val-04b2-session';
    const preflightResult = this.preflightPolicy.evaluate({
      config: {
        environment: 'testnet',
        allowedInstruments: [VAL_04B2_INSTRUMENT],
        maxOrderNotional,
        maxTotalRunNotional: maxOrderNotional,
        maxOutstandingOrders: 1,
        tenantId,
        runSessionId,
      },
      order: {
        instrument: VAL_04B2_INSTRUMENT,
        quantity: preparedOrder.quantity,
        price: preparedOrder.price,
        clientOrderId: executionClientOrderId,
        tenantId,
        runSessionId,
      },
      currentRunState: {
        accumulatedNotional: 0,
        activeOrders: new Set<string>(),
      },
      credentialScopes: Array.from(metadata.scopes),
    });

    if (!preflightResult.passed) {
      throw new Val04B2BoundaryError(
        `Safety preflight rejected candidate order: ${preflightResult.reason ?? preflightResult.violationCode}`,
      );
    }

    // 10. Phase 3: Submit exactly ONE LIMIT order
    const authHeaders = { 'X-MBX-APIKEY': material.apiKey };
    const submitParams = await signVal04B2Query(
      {
        symbol: VAL_04B2_SYMBOL,
        side: 'BUY',
        type: 'LIMIT',
        timeInForce: 'GTC',
        quantity: preparedOrder.quantity.toString(),
        price: preparedOrder.price.toString(),
        newClientOrderId: executionClientOrderId,
        recvWindow: '5000',
        timestamp: this.now().toString(),
      },
      material.apiSecret,
    );

    let submitRes: Val04B2HttpResponse;
    try {
      submitRes = await this.transport.post(
        `${this.baseUrl}${VAL_04B2_ORDER_PATH}`,
        submitParams,
        authHeaders,
        this.timeoutMs,
      );
    } catch (networkError) {
      // Ambiguous execution rule: transport failure -> do NOT resubmit blindly.
      throw new Val04B2BoundaryError(
        `Order submission encountered ambiguous network failure: ${networkError instanceof Error ? networkError.message : String(networkError)}. Resubmission prohibited.`,
      );
    }

    if (submitRes.status !== 200) {
      const errBody = await submitRes.json().catch(() => ({}));
      throw new Val04B2BoundaryError(
        `Order submission failed with HTTP ${submitRes.status}: ${JSON.stringify(errBody)}`,
      );
    }

    const submitJson = (await submitRes.json()) as Record<string, unknown>;
    const submissionStatus = String(submitJson.status ?? 'UNKNOWN');
    const providerOrderId = submitJson.orderId as string | number | undefined;

    // 11. Phase 4: Exact REST lookup & identity verification
    const lookupParams = await signVal04B2Query(
      {
        symbol: VAL_04B2_SYMBOL,
        origClientOrderId: executionClientOrderId,
        recvWindow: '5000',
        timestamp: this.now().toString(),
      },
      material.apiSecret,
    );

    const lookupRes = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_ORDER_PATH}`,
      lookupParams,
      authHeaders,
      this.timeoutMs,
    );
    if (lookupRes.status !== 200) {
      throw new Val04B2BoundaryError(`Exact lookup after submission failed with HTTP ${lookupRes.status}`);
    }

    const lookupJson = (await lookupRes.json()) as Record<string, unknown>;
    const returnedClientOrderId = String(lookupJson.clientOrderId ?? '');
    const identityPreserved = returnedClientOrderId === executionClientOrderId;
    if (!identityPreserved) {
      throw new Val04B2BoundaryError(
        `Identity continuity broken: submitted '${executionClientOrderId}', received '${returnedClientOrderId}'`,
      );
    }
    const lookupStatusAfterSubmit = String(lookupJson.status ?? '');

    // 12. Phase 5: Cancel the active testnet order
    const cancelParams = await signVal04B2Query(
      {
        symbol: VAL_04B2_SYMBOL,
        origClientOrderId: executionClientOrderId,
        recvWindow: '5000',
        timestamp: this.now().toString(),
      },
      material.apiSecret,
    );

    const cancelRes = await this.transport.delete(
      `${this.baseUrl}${VAL_04B2_ORDER_PATH}`,
      cancelParams,
      authHeaders,
      this.timeoutMs,
    );
    if (cancelRes.status !== 200) {
      throw new Val04B2BoundaryError(`Order cancellation request failed with HTTP ${cancelRes.status}`);
    }
    const cancelJson = (await cancelRes.json()) as Record<string, unknown>;
    const cancellationStatus = String(cancelJson.status ?? '');

    // 13. Phase 6: Terminal reconciliation
    const terminalLookupParams = await signVal04B2Query(
      {
        symbol: VAL_04B2_SYMBOL,
        origClientOrderId: executionClientOrderId,
        recvWindow: '5000',
        timestamp: this.now().toString(),
      },
      material.apiSecret,
    );

    const terminalLookupRes = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_ORDER_PATH}`,
      terminalLookupParams,
      authHeaders,
      this.timeoutMs,
    );
    let terminalReconciliationStatus = 'UNKNOWN';
    if (terminalLookupRes.status === 200) {
      const termJson = (await terminalLookupRes.json()) as Record<string, unknown>;
      terminalReconciliationStatus = String(termJson.status ?? '');
    } else {
      terminalReconciliationStatus = `HTTP_${terminalLookupRes.status}`;
    }

    // 14. Phase 7: Mandatory cleanup verification
    const openOrdersParams = await signVal04B2Query(
      {
        symbol: VAL_04B2_SYMBOL,
        recvWindow: '5000',
        timestamp: this.now().toString(),
      },
      material.apiSecret,
    );

    const openOrdersRes = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_OPEN_ORDERS_PATH}`,
      openOrdersParams,
      authHeaders,
      this.timeoutMs,
    );
    let residualActiveOrdersCount = 0;
    if (openOrdersRes.status === 200) {
      const openOrdersJson = (await openOrdersRes.json()) as Array<Record<string, unknown>>;
      residualActiveOrdersCount = openOrdersJson.filter(
        (o) => o.clientOrderId === executionClientOrderId,
      ).length;
    }

    const positionRiskParams = await signVal04B2Query(
      {
        symbol: VAL_04B2_SYMBOL,
        recvWindow: '5000',
        timestamp: this.now().toString(),
      },
      material.apiSecret,
    );

    const positionRiskRes = await this.transport.get(
      `${this.baseUrl}${VAL_04B2_POSITION_RISK_PATH}`,
      positionRiskParams,
      authHeaders,
      this.timeoutMs,
    );
    let residualPositionAmount = 0;
    if (positionRiskRes.status === 200) {
      const positionsJson = (await positionRiskRes.json()) as Array<Record<string, unknown>>;
      const btcPosition = positionsJson.find((p) => p.symbol === VAL_04B2_SYMBOL);
      if (btcPosition && btcPosition.positionAmt !== undefined) {
        residualPositionAmount = Math.abs(Number(btcPosition.positionAmt));
      }
    }

    const cleanupPassed =
      residualActiveOrdersCount === 0 &&
      residualPositionAmount === 0 &&
      (terminalReconciliationStatus === 'CANCELED' || cancellationStatus === 'CANCELED');

    return {
      environment: VAL_04B2_ENVIRONMENT,
      symbol: VAL_04B2_SYMBOL,
      instrument: VAL_04B2_INSTRUMENT,
      executionClientOrderId,
      providerOrderId,
      submittedPrice: preparedOrder.price,
      submittedQuantity: preparedOrder.quantity,
      submittedNotional: preparedOrder.notional,
      preflightPassed: true,
      submissionStatus,
      lookupStatusAfterSubmit,
      identityPreserved,
      cancellationStatus,
      terminalReconciliationStatus,
      residualActiveOrdersCount,
      residualPositionAmount,
      blindRetries: 0,
      ordersSubmitted: 1,
      websocketUsed: false,
      mainnetExcluded: true,
      secretsExposed: false,
      cleanupPassed,
    };
  }
}

