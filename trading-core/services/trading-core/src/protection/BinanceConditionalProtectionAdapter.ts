import type {
  Val04B1CredentialSource,
} from '../external/Val04B1AuthenticatedReadHarness.js';
import {
  VAL_04B2_BASE_URL,
  VAL_04B2_ORDER_PATH,
  VAL_04B2_OPEN_ORDERS_PATH,
  VAL_04B2_POSITION_RISK_PATH,
  type Val04B2HttpResponse,
  type Val04B2Transport,
  signVal04B2Query,
} from '../external/Val04B2ControlledOrderHarness.js';
import { Val04B2LiveTransport } from '../external/Val04B2LiveTransport.js';
import type {
  PositionProtectionPlanV1,
  ProtectionRuleV1,
  PositionProtectionCapabilitySnapshotV1,
  EmergencyCloseCommandV1,
  ProtectionSubmissionResultV1,
  ProtectionReconciliationResultV1,
  PositionSideModeV1,
} from './PositionProtectionContracts.js';

export interface BinanceProtectionAdapterOptions {
  baseUrl?: string;
  timeoutMs?: number;
  environment?: string;
  now?: () => string;
}

const DEFAULT_BASE_URL = 'https://testnet.binancefuture.com';
const VAL_04B2_POSITION_SIDE_DUAL_PATH = '/fapi/v1/positionSide/dual';
export const VAL_04B2_ALGO_ORDER_PATH = '/fapi/v1/algoOrder';
export const VAL_04B2_OPEN_ALGO_ORDERS_PATH = '/fapi/v1/openAlgoOrders';

export interface BinancePositionRiskItemV1 {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice?: string;
  unRealizedProfit?: string;
  positionSide?: string;
}

export class BinanceConditionalProtectionAdapter {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly environment: string;
  private readonly now: () => string;

  constructor(
    private readonly credentialSource?: Val04B1CredentialSource,
    private readonly transport: Val04B2Transport = new Val04B2LiveTransport(),
    options: BinanceProtectionAdapterOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.environment = options.environment ?? 'testnet';
    this.now = options.now ?? (() => new Date().toISOString());
  }

  getCapabilitySnapshot(): PositionProtectionCapabilitySnapshotV1 {
    return {
      providerId: 'binance-perpetual-futures',
      environment: this.environment,
      supportsCloseAll: true,
      supportsQuantityBounded: true,
      supportsStopMarket: true,
      supportsTakeProfitMarket: true,
      supportsTrailingStop: true,
      supportsMarkPriceTrigger: true,
      supportsPriceProtection: true,
      supportedPositionModes: ['ONE_WAY', 'HEDGE'],
      timestamp: this.now(),
    };
  }

  async getPositionMode(): Promise<PositionSideModeV1> {
    const response = await this.privateRequest('GET', VAL_04B2_POSITION_SIDE_DUAL_PATH, {});
    const body = await this.bodyOf(response);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Failed to query position side dual setting: HTTP ${response.status} - ${JSON.stringify(body)}`);
    }
    const record = body as Record<string, unknown>;
    const dualSidePosition = Boolean(record.dualSidePosition);
    return dualSidePosition ? 'HEDGE' : 'ONE_WAY';
  }

  async getPositionRisk(symbol?: string): Promise<BinancePositionRiskItemV1[]> {
    const params: Record<string, string> = {
      recvWindow: '5000',
      timestamp: String(Date.now()),
    };
    if (symbol) {
      params.symbol = symbol.toUpperCase();
    }
    const response = await this.privateRequest('GET', VAL_04B2_POSITION_RISK_PATH, params);
    const body = await this.bodyOf(response);
    if (response.status < 200 || response.status >= 300 || !Array.isArray(body)) {
      throw new Error(`Failed to query position risk: HTTP ${response.status} - ${JSON.stringify(body)}`);
    }
    return (body as Array<Record<string, unknown>>).map((p) => ({
      symbol: String(p.symbol ?? ''),
      positionAmt: String(p.positionAmt ?? '0'),
      entryPrice: String(p.entryPrice ?? '0'),
      markPrice: p.markPrice !== undefined ? String(p.markPrice) : undefined,
      unRealizedProfit: p.unRealizedProfit !== undefined ? String(p.unRealizedProfit) : undefined,
      positionSide: p.positionSide !== undefined ? String(p.positionSide) : undefined,
    }));
  }

  validateRulePreflight(rule: ProtectionRuleV1, plan: PositionProtectionPlanV1): void {
    if (!rule.ruleId || !rule.clientProtectionOrderId || !rule.triggerPrice) {
      throw new Error('Invalid protection rule: ruleId, clientProtectionOrderId and triggerPrice are mandatory.');
    }

    if (rule.executionMode === 'CLOSE_ALL') {
      if (rule.quantity !== undefined && rule.quantity !== '') {
        throw new Error('CLOSE_ALL execution mode prohibits quantity field. Quantity must be omitted.');
      }
    } else if (rule.executionMode === 'QUANTITY_BOUNDED') {
      if (!rule.quantity || isNaN(Number(rule.quantity)) || Number(rule.quantity) <= 0) {
        throw new Error(`QUANTITY_BOUNDED execution mode requires a strictly positive quantity. Got: ${rule.quantity}`);
      }
    } else {
      throw new Error(`Unsupported execution mode: ${rule.executionMode}`);
    }

    if (plan.positionMode === 'HEDGE') {
      if (plan.positionSide === 'BOTH') {
        throw new Error('Hedge Mode requires explicit LONG or SHORT positionSide. Got BOTH.');
      }
    } else if (plan.positionMode === 'ONE_WAY') {
      if (plan.positionSide !== 'BOTH' && plan.positionSide !== 'LONG' && plan.positionSide !== 'SHORT') {
        throw new Error(`Invalid positionSide for ONE_WAY mode: ${plan.positionSide}`);
      }
    }
  }

  /**
   * Submit conditional protection rule via Binance USDⓈ-M Algo Order API (/fapi/v1/algoOrder).
   */
  async submitProtectionRule(
    rule: ProtectionRuleV1,
    plan: PositionProtectionPlanV1,
  ): Promise<ProtectionSubmissionResultV1> {
    this.validateRulePreflight(rule, plan);

    const orderSide = plan.positionSide === 'SHORT' ? 'BUY' : 'SELL';
    const binancePositionSide = plan.positionMode === 'HEDGE'
      ? plan.positionSide
      : 'BOTH';

    const orderType = rule.ruleType === 'HARD_STOP'
      ? 'STOP_MARKET'
      : rule.ruleType === 'TAKE_PROFIT'
        ? 'TAKE_PROFIT_MARKET'
        : 'STOP_MARKET';

    // Binance Algo API parameters: uses triggerPrice, clientAlgoId, algoType='CONDITIONAL'
    const params: Record<string, string> = {
      symbol: plan.symbol.toUpperCase(),
      side: orderSide,
      positionSide: binancePositionSide,
      algoType: 'CONDITIONAL',
      type: orderType,
      triggerPrice: rule.triggerPrice, // NEVER emit stopPrice to Algo API
      workingType: rule.triggerPriceSource === 'MARK_PRICE' ? 'MARK_PRICE' : 'CONTRACT_PRICE',
      priceProtect: rule.enablePriceProtection ? 'TRUE' : 'FALSE',
      clientAlgoId: rule.clientProtectionOrderId, // preserved client identifier
      recvWindow: '5000',
      timestamp: String(Date.now()),
    };

    if (rule.executionMode === 'CLOSE_ALL') {
      params.closePosition = 'true';
    } else {
      params.quantity = rule.quantity!;
      if (plan.positionMode === 'ONE_WAY') {
        params.reduceOnly = 'true';
      }
    }

    try {
      const response = await this.privateRequest('POST', VAL_04B2_ALGO_ORDER_PATH, params);
      const body = await this.bodyOf(response);

      if (response.status >= 200 && response.status < 300) {
        const record = body as Record<string, unknown>;
        const providerAlgoId = String(record.algoId ?? record.orderId ?? '');
        return {
          success: true,
          ruleId: rule.ruleId,
          clientProtectionOrderId: rule.clientProtectionOrderId,
          providerProtectionOrderId: providerAlgoId,
          state: 'SUBMITTED',
          rawResponse: record,
        };
      }

      const rejectionRecord = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
      const code = String(rejectionRecord.code ?? 'UNKNOWN_REJECTION');
      const errorMsg = String(rejectionRecord.msg ?? JSON.stringify(body));

      return {
        success: false,
        ruleId: rule.ruleId,
        clientProtectionOrderId: rule.clientProtectionOrderId,
        state: 'REJECTED',
        error: `Algo protection order rejected: HTTP ${response.status} - Code ${code}: ${errorMsg}`,
        rejectionCode: code,
        rawResponse: rejectionRecord,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        ruleId: rule.ruleId,
        clientProtectionOrderId: rule.clientProtectionOrderId,
        state: 'UNKNOWN_AWAITING_RECONCILIATION',
        error: `Protection submission failed/timed out: ${message}. Requires immediate reconciliation.`,
        rejectionCode: 'TRANSPORT_OR_TIMEOUT_ERROR',
      };
    }
  }

  /**
   * Reconcile protection rule by clientProtectionOrderId (clientAlgoId) or ruleId against Binance Algo endpoints.
   */
  async reconcileProtectionRule(
    symbol: string,
    clientProtectionOrderId: string,
    ruleId: string,
  ): Promise<ProtectionReconciliationResultV1 | null> {
    // 1. Try lookup in open algo orders
    const openAlgos = await this.getOpenProtectionOrders(symbol);
    const matched = openAlgos.find((o) => o.clientProtectionOrderId === clientProtectionOrderId);
    if (matched) {
      return matched;
    }

    // 2. Query exact algo order endpoint GET /fapi/v1/algoOrder
    try {
      const response = await this.privateRequest('GET', VAL_04B2_ALGO_ORDER_PATH, {
        symbol: symbol.toUpperCase(),
        clientAlgoId: clientProtectionOrderId,
      });
      const body = await this.bodyOf(response);
      if (response.status >= 200 && response.status < 300 && body && typeof body === 'object' && !Array.isArray(body)) {
        const record = body as Record<string, unknown>;
        const algoId = String(record.algoId ?? record.orderId ?? '');
        if (!algoId) {
          return null;
        }

        const algoStatus = String(record.algoStatus ?? record.status ?? 'NEW');
        let state: ProtectionReconciliationResultV1['state'] = 'RECONCILED_ACTIVE';
        if (algoStatus === 'FILLED' || algoStatus === 'TRIGGERED') state = 'FILLED';
        else if (algoStatus === 'CANCELED' || algoStatus === 'CANCELLED') state = 'CANCELLED';
        else if (algoStatus === 'EXPIRED') state = 'EXPIRED';
        else if (algoStatus === 'REJECTED') state = 'REJECTED';
        else if (algoStatus === 'NEW' || algoStatus === 'PARTIALLY_FILLED') state = 'RECONCILED_ACTIVE';
        else state = 'REJECTED';

        return {
          ruleId,
          clientProtectionOrderId,
          providerProtectionOrderId: algoId,
          state,
          symbol: String(record.symbol ?? symbol).toUpperCase(),
          side: String(record.side ?? 'sell').toLowerCase() as 'buy' | 'sell',
          type: String(record.orderType ?? record.type ?? 'STOP_MARKET'),
          stopPrice: record.triggerPrice ? String(record.triggerPrice) : record.stopPrice ? String(record.stopPrice) : undefined,
          origQty: record.quantity ? String(record.quantity) : record.origQty ? String(record.origQty) : undefined,
          executedQty: record.executedQty ? String(record.executedQty) : undefined,
          closePosition: record.closePosition !== undefined ? Boolean(record.closePosition) : undefined,
          workingType: record.workingType ? String(record.workingType) : undefined,
          priceProtect: record.priceProtect !== undefined ? Boolean(record.priceProtect) : undefined,
          reconciledAt: this.now(),
        };
      }
    } catch {
      // Order not found or query error
    }

    return null;
  }

  /**
   * Query all open algo protection orders from GET /fapi/v1/openAlgoOrders.
   */
  async getOpenProtectionOrders(symbol: string): Promise<ProtectionReconciliationResultV1[]> {
    try {
      const response = await this.privateRequest('GET', VAL_04B2_OPEN_ALGO_ORDERS_PATH, {
        symbol: symbol.toUpperCase(),
      });
      const body = await this.bodyOf(response);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to query open algo protection orders: HTTP ${response.status} - ${JSON.stringify(body)}`);
      }
      if (!Array.isArray(body)) {
        return [];
      }

      return body
        .filter((item: Record<string, unknown>) => {
          const type = String(item.orderType ?? item.type ?? '');
          return (
            type === 'STOP_MARKET' ||
            type === 'TAKE_PROFIT_MARKET' ||
            type === 'TRAILING_STOP_MARKET' ||
            type === 'STOP' ||
            type === 'TAKE_PROFIT' ||
            String(item.algoType ?? '') === 'CONDITIONAL'
          );
        })
        .map((item: Record<string, unknown>) => {
          const clientAlgoId = String(item.clientAlgoId ?? item.clientOrderId ?? '');
          const algoId = String(item.algoId ?? item.orderId ?? '');
          return {
            ruleId: clientAlgoId ? `rule_${clientAlgoId}` : `rule_${algoId}`,
            clientProtectionOrderId: clientAlgoId,
            providerProtectionOrderId: algoId,
            state: 'RECONCILED_ACTIVE',
            symbol: String(item.symbol ?? symbol).toUpperCase(),
            side: String(item.side ?? 'sell').toLowerCase() as 'buy' | 'sell',
            type: String(item.orderType ?? item.type ?? 'STOP_MARKET'),
            stopPrice: item.triggerPrice ? String(item.triggerPrice) : item.stopPrice ? String(item.stopPrice) : undefined,
            origQty: item.quantity ? String(item.quantity) : item.origQty ? String(item.origQty) : undefined,
            executedQty: item.executedQty ? String(item.executedQty) : undefined,
            closePosition: item.closePosition !== undefined ? Boolean(item.closePosition) : undefined,
            workingType: item.workingType ? String(item.workingType) : undefined,
            priceProtect: item.priceProtect !== undefined ? Boolean(item.priceProtect) : undefined,
            reconciledAt: this.now(),
          };
        });
    } catch {
      return [];
    }
  }

  /**
   * Cancel an active algo protection order via DELETE /fapi/v1/algoOrder.
   */
  async cancelProtectionOrder(
    symbol: string,
    clientProtectionOrderId?: string,
    providerProtectionOrderId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!clientProtectionOrderId && !providerProtectionOrderId) {
      throw new Error('Either clientProtectionOrderId or providerProtectionOrderId is required to cancel algo protection.');
    }

    const params: Record<string, string> = {
      symbol: symbol.toUpperCase(),
      recvWindow: '5000',
      timestamp: String(Date.now()),
    };
    if (providerProtectionOrderId) params.algoId = providerProtectionOrderId;
    if (clientProtectionOrderId) params.clientAlgoId = clientProtectionOrderId;

    try {
      const response = await this.privateRequest('DELETE', VAL_04B2_ALGO_ORDER_PATH, params);
      const body = await this.bodyOf(response);
      if (response.status >= 200 && response.status < 300) {
        return { success: true };
      }
      return { success: false, error: `Algo cancellation rejected: HTTP ${response.status} - ${JSON.stringify(body)}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  /**
   * Execute emergency close order via normal order API (POST /fapi/v1/order).
   */
  async executeEmergencyClose(
    command: EmergencyCloseCommandV1,
  ): Promise<{ success: boolean; orderId?: string; error?: string }> {
    const orderSide = command.positionSide === 'SHORT' ? 'BUY' : 'SELL';
    const binancePositionSide = command.positionMode === 'HEDGE' ? command.positionSide : 'BOTH';

    const params: Record<string, string> = {
      symbol: command.symbol.toUpperCase(),
      side: orderSide,
      positionSide: binancePositionSide,
      type: 'MARKET',
      newClientOrderId: `axd_emg_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    };

    if (command.executionMode === 'CLOSE_ALL') {
      params.closePosition = 'true';
    } else {
      if (!command.quantity || Number(command.quantity) <= 0) {
        throw new Error('EmergencyClose with QUANTITY_BOUNDED requires positive quantity.');
      }
      params.quantity = command.quantity;
      if (command.positionMode === 'ONE_WAY') {
        params.reduceOnly = 'true';
      }
    }

    try {
      const response = await this.privateRequest('POST', VAL_04B2_ORDER_PATH, params);
      const body = await this.bodyOf(response);

      if (response.status >= 200 && response.status < 300) {
        const record = body as Record<string, unknown>;
        return { success: true, orderId: String(record.orderId) };
      }

      return {
        success: false,
        error: `Emergency close rejected: HTTP ${response.status} - ${JSON.stringify(body)}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }

  private async privateRequest(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Record<string, string>,
  ): Promise<Val04B2HttpResponse> {
    if (!this.credentialSource) {
      throw new Error('Authenticated request requires a configured Val04B1CredentialSource.');
    }
    const material = await this.credentialSource.resolveEphemeralMaterial();
    const signedParams = await signVal04B2Query(
      {
        ...params,
        timestamp: params.timestamp ?? String(Date.now()),
        recvWindow: params.recvWindow ?? '5000',
      },
      material.apiSecret,
    );

    const headers: Record<string, string> = {
      'X-MBX-APIKEY': material.apiKey,
    };

    const url = `${this.baseUrl}${path}`;

    if (method === 'GET') {
      return this.transport.get(url, signedParams, headers, this.timeoutMs);
    }
    if (method === 'POST') {
      return this.transport.post(url, signedParams, headers, this.timeoutMs);
    }
    if (method === 'DELETE') {
      return this.transport.delete(url, signedParams, headers, this.timeoutMs);
    }

    throw new Error(`Unsupported method ${method}`);
  }

  private async bodyOf(response: Val04B2HttpResponse): Promise<unknown> {
    return response.json().catch(() => ({}));
  }
}
