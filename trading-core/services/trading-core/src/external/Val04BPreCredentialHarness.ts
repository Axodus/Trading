export const VAL_04B_ENVIRONMENT = 'binance_perpetual_testnet' as const;
export const VAL_04B_SYMBOL = 'BTCUSDT' as const;
export const VAL_04B_AXODUS_INSTRUMENT = 'BTC-USDT' as const;

export type ExternalExecutionGateState = 'CLOSED' | 'OPEN';

export interface BinanceSymbolFilter {
  filterType: string;
  minQty?: string;
  maxQty?: string;
  stepSize?: string;
  minPrice?: string;
  maxPrice?: string;
  tickSize?: string;
  minNotional?: string;
  notional?: string;
}

export interface BinanceExchangeInfoSymbol {
  symbol: string;
  status?: string;
  contractType?: string;
  quoteAsset?: string;
  baseAsset?: string;
  filters: BinanceSymbolFilter[];
}

export interface BinanceExchangeInfo {
  exchangeFilters?: BinanceSymbolFilter[];
  symbols: BinanceExchangeInfoSymbol[];
}

export interface RuntimeVenueRules {
  symbol: string;
  instrument: typeof VAL_04B_AXODUS_INSTRUMENT;
  tickSize: number;
  stepSize: number;
  minQuantity: number;
  maxQuantity?: number;
  minNotional: number;
}

export interface PreparedExternalOrder {
  environment: typeof VAL_04B_ENVIRONMENT;
  symbol: typeof VAL_04B_SYMBOL;
  instrument: typeof VAL_04B_AXODUS_INSTRUMENT;
  side: 'BUY' | 'SELL';
  type: 'LIMIT';
  quantity: number;
  price: number;
  notional: number;
  clientOrderId: string;
  positionIntent: 'NONE';
}

export interface Val04BPreflightInput {
  exchangeInfo: BinanceExchangeInfo;
  referencePrice: number;
  clientOrderId: string;
  side?: 'BUY' | 'SELL';
  maxOrderNotional: number;
  credentialCapability: 'ABSENT' | 'PRESENT_BUT_NOT_AUTHORIZED';
}

export interface Val04BPreflightResult {
  passed: boolean;
  environment: typeof VAL_04B_ENVIRONMENT;
  transport: 'http';
  rules?: RuntimeVenueRules;
  order?: PreparedExternalOrder;
  failures: string[];
  externalExecutionGate: ExternalExecutionGateState;
  privateCallsMade: false;
  websocketUsed: false;
}

export interface PublicHttpResponse {
  status: number;
  json(): Promise<unknown>;
}

export interface PublicHttpTransport {
  get(path: string, timeoutMs: number): Promise<PublicHttpResponse>;
}

const MAX_CLIENT_ORDER_ID_LENGTH = 32;

function decimalPlaces(value: number): number {
  const text = value.toString();
  const exponent = text.indexOf('e');
  if (exponent >= 0) return Math.max(0, Number(text.slice(exponent + 1)) * -1);
  return (text.split('.')[1] ?? '').length;
}

function roundDownToStep(value: number, step: number): number {
  const places = Math.max(decimalPlaces(step), 8);
  const scale = 10 ** places;
  return Number((Math.floor((value * scale) / (step * scale)) * step).toFixed(decimalPlaces(step)));
}

function roundUpToStep(value: number, step: number): number {
  const places = Math.max(decimalPlaces(step), 8);
  const scale = 10 ** places;
  return Number((Math.ceil((value * scale) / (step * scale)) * step).toFixed(decimalPlaces(step)));
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`);
  return value;
}

function getFilter(symbol: BinanceExchangeInfoSymbol, type: string): BinanceSymbolFilter | undefined {
  return symbol.filters.find((filter) => filter.filterType === type);
}

export function deriveRuntimeVenueRules(exchangeInfo: BinanceExchangeInfo): RuntimeVenueRules {
  const symbol = exchangeInfo.symbols.find((candidate) => candidate.symbol === VAL_04B_SYMBOL);
  if (!symbol) throw new Error(`Runtime exchange-info does not admit ${VAL_04B_SYMBOL}`);
  if (symbol.status && symbol.status !== 'TRADING') throw new Error(`${VAL_04B_SYMBOL} is not TRADING`);

  const priceFilter = getFilter(symbol, 'PRICE_FILTER');
  const lotFilter = getFilter(symbol, 'LOT_SIZE') ?? getFilter(symbol, 'MARKET_LOT_SIZE');
  const notionalFilter = getFilter(symbol, 'MIN_NOTIONAL') ?? getFilter(symbol, 'NOTIONAL');
  const tickSize = finitePositive(Number(priceFilter?.tickSize), 'tickSize');
  const stepSize = finitePositive(Number(lotFilter?.stepSize), 'stepSize');
  const minQuantity = finitePositive(Number(lotFilter?.minQty), 'minQty');
  const minNotional = finitePositive(
    Number(notionalFilter?.minNotional ?? notionalFilter?.notional),
    'minNotional',
  );

  return {
    symbol: VAL_04B_SYMBOL,
    instrument: VAL_04B_AXODUS_INSTRUMENT,
    tickSize,
    stepSize,
    minQuantity,
    maxQuantity: lotFilter?.maxQty ? Number(lotFilter.maxQty) : undefined,
    minNotional,
  };
}

export function deriveMinimumValidLimitOrder(
  rules: RuntimeVenueRules,
  referencePrice: number,
  maxOrderNotional: number,
  clientOrderId: string,
  side: 'BUY' | 'SELL' = 'BUY',
): PreparedExternalOrder {
  finitePositive(referencePrice, 'referencePrice');
  finitePositive(maxOrderNotional, 'maxOrderNotional');
  if (!clientOrderId || clientOrderId.length > MAX_CLIENT_ORDER_ID_LENGTH) {
    throw new Error(`clientOrderId must be 1-${MAX_CLIENT_ORDER_ID_LENGTH} characters`);
  }

  const price = roundDownToStep(referencePrice, rules.tickSize);
  if (price <= 0) throw new Error('referencePrice produces no valid venue price tick');
  const minimumQuantityForNotional = rules.minNotional / price;
  const quantity = roundUpToStep(Math.max(rules.minQuantity, minimumQuantityForNotional), rules.stepSize);
  if (rules.maxQuantity !== undefined && quantity > rules.maxQuantity) {
    throw new Error('Runtime minimum valid quantity exceeds the venue maximum quantity');
  }
  const notional = quantity * price;
  if (notional > maxOrderNotional) {
    throw new Error('Runtime minimum valid order exceeds the Axodus hard notional ceiling');
  }

  return {
    environment: VAL_04B_ENVIRONMENT,
    symbol: VAL_04B_SYMBOL,
    instrument: VAL_04B_AXODUS_INSTRUMENT,
    side,
    type: 'LIMIT',
    quantity,
    price,
    notional,
    clientOrderId,
    positionIntent: 'NONE',
  };
}

export class ExternalExecutionGate {
  private state: ExternalExecutionGateState = 'CLOSED';

  getState(): ExternalExecutionGateState {
    return this.state;
  }

  open(explicitApproval: { approval: 'VAL-04B-EXTERNAL-EXECUTION-APPROVED' }): void {
    if (explicitApproval.approval !== 'VAL-04B-EXTERNAL-EXECUTION-APPROVED') {
      throw new Error('External execution requires the explicit VAL-04B approval token');
    }
    this.state = 'OPEN';
  }

  assertOpen(): void {
    if (this.state !== 'OPEN') {
      throw new Error('External execution gate is CLOSED; pre-credential harness cannot submit orders');
    }
  }
}

export class Val04BPreCredentialHarness {
  readonly gate = new ExternalExecutionGate();

  prepare(input: Val04BPreflightInput): Val04BPreflightResult {
    const failures: string[] = [];
    let rules: RuntimeVenueRules | undefined;
    let order: PreparedExternalOrder | undefined;
    try {
      rules = deriveRuntimeVenueRules(input.exchangeInfo);
      order = deriveMinimumValidLimitOrder(
        rules,
        input.referencePrice,
        input.maxOrderNotional,
        input.clientOrderId,
        input.side,
      );
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'Unable to derive runtime order rules');
    }
    if (input.credentialCapability !== 'ABSENT') {
      failures.push('Credential capability is not admitted during the pre-credential gate');
    }
    if (this.gate.getState() !== 'CLOSED') failures.push('External execution gate must remain closed during pre-credential validation');
    return {
      passed: failures.length === 0,
      environment: VAL_04B_ENVIRONMENT,
      transport: 'http',
      rules,
      order,
      failures,
      externalExecutionGate: this.gate.getState(),
      privateCallsMade: false,
      websocketUsed: false,
    };
  }

  assertNoSubmission(): never {
    this.gate.assertOpen();
    throw new Error('Submission is outside the pre-credential harness');
  }
}

export async function verifyPublicExchangeInfo(
  transport: PublicHttpTransport,
  timeoutMs = 5000,
): Promise<BinanceExchangeInfo> {
  const response = await transport.get('/fapi/v1/exchangeInfo', timeoutMs);
  if (response.status !== 200) throw new Error(`Public exchange-info failed with HTTP ${response.status}`);
  return (await response.json()) as BinanceExchangeInfo;
}
