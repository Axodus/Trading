import type {
  AxodusExecutionProvider,
  AxodusExecutionRequest,
  ExecutionResult,
} from '../../../../../../packages/trading-contracts/src/index.js';
import {
  ExecutionProviderBoundaryError as BoundaryError,
} from '../../../../../../packages/trading-contracts/src/index.js';
import { assertHummingbotBaseline, isAdmittedHummingbotTransport } from './HummingbotDependencyBaseline.js';

export interface HummingbotHttpTransportResponse {
  status: number;
  body: unknown;
}

export interface HummingbotHttpTransport {
  post(path: string, body: Record<string, unknown>, headers: Record<string, string>): Promise<HummingbotHttpTransportResponse>;
}

export interface HummingbotHttpAuthProvider {
  getHeaders(context: { correlationId: string; intentId: string }): Promise<Record<string, string>>;
}

export interface HummingbotHttpExecutionProviderOptions {
  accountName: string;
  connectorName: string;
  transport: HummingbotHttpTransport;
  auth: HummingbotHttpAuthProvider;
  dependencyBaseline?: {
    condorRevision: string;
    apiClientRevision: string;
    apiClientVersion: string;
    apiServerRevision: string;
  };
}

type HummingbotTradeResponse = {
  order_id?: unknown;
  status?: unknown;
};

export class HummingbotHttpExecutionProvider implements AxodusExecutionProvider {
  readonly id = 'hummingbot-http';

  private readonly accountName: string;
  private readonly connectorName: string;
  private readonly transport: HummingbotHttpTransport;
  private readonly auth: HummingbotHttpAuthProvider;

  constructor(options: HummingbotHttpExecutionProviderOptions) {
    assertHummingbotBaseline(options.dependencyBaseline ?? baselineToRevisionInput());
    if (!isAdmittedHummingbotTransport('http')) {
      throw new BoundaryError({
        code: 'PROVIDER_PROTOCOL_ERROR',
        operation: 'execute-order',
        message: 'Hummingbot HTTP transport is not admitted by the Axodus baseline',
        retryable: false,
      });
    }
    if (!options.accountName || !options.connectorName) {
      throw new BoundaryError({
        code: 'INVALID_REQUEST',
        operation: 'execute-order',
        message: 'Hummingbot account and connector are required at the adapter boundary',
        retryable: false,
      });
    }
    this.accountName = options.accountName;
    this.connectorName = options.connectorName;
    this.transport = options.transport;
    this.auth = options.auth;
  }

  async executeOrder(request: AxodusExecutionRequest): Promise<ExecutionResult> {
    validateRequest(request);

    const headers = {
      'content-type': 'application/json',
      'x-axodus-correlation-id': request.correlationId,
      'x-axodus-intent-id': request.intentId,
      ...(await this.auth.getHeaders({ correlationId: request.correlationId, intentId: request.intentId })),
    };
    const body = toHummingbotTradeRequest(request, this.accountName, this.connectorName);

    let response: HummingbotHttpTransportResponse;
    try {
      response = await this.transport.post('/trading/orders', body, headers);
    } catch (error) {
      throw mapTransportFailure(request, error);
    }

    if (response.status < 200 || response.status >= 300) {
      throw mapHttpFailure(request, response);
    }

    return fromHummingbotTradeResponse(request.requestId, response.body);
  }
}

function baselineToRevisionInput(): {
  condorRevision: string;
  apiClientRevision: string;
  apiClientVersion: string;
  apiServerRevision: string;
} {
  return {
    condorRevision: 'd89e74f2e3e273bea102c64e4977118e6a88084f',
    apiClientRevision: 'dae015a3c513879ed06a55cf2b2c10e5772c0962',
    apiClientVersion: 'v1.5.9',
    apiServerRevision: '2494e847538bb7b819495cbc30eb4ef828feaacd',
  };
}

function validateRequest(request: AxodusExecutionRequest): void {
  if (!request.intentId || !request.correlationId || !request.authorization.authorizationId || !request.authorization.policyVersion) {
    throw new BoundaryError({
      code: 'AUTHORIZATION_REQUIRED',
      operation: 'execute-order',
      message: 'Axodus authorization and correlation context are required',
      retryable: false,
    });
  }
  if (request.orderType !== 'market' && request.orderType !== 'limit') {
    throw new BoundaryError({
      code: 'INVALID_REQUEST',
      operation: 'execute-order',
      message: `Order type ${request.orderType} is outside the admitted Hummingbot HTTP surface`,
      retryable: false,
    });
  }
  if (!request.quantity || !Number.isFinite(Number(request.quantity)) || Number(request.quantity) <= 0) {
    throw new BoundaryError({
      code: 'INVALID_REQUEST',
      operation: 'execute-order',
      message: 'Order quantity must be a positive numeric value',
      retryable: false,
    });
  }
  if (request.orderType === 'limit' && (!request.price || !Number.isFinite(Number(request.price)) || Number(request.price) <= 0)) {
    throw new BoundaryError({
      code: 'INVALID_REQUEST',
      operation: 'execute-order',
      message: 'Limit orders require a positive numeric price',
      retryable: false,
    });
  }
}

function toHummingbotTradeRequest(
  request: AxodusExecutionRequest,
  accountName: string,
  connectorName: string,
): Record<string, unknown> {
  return {
    account_name: accountName,
    connector_name: connectorName,
    trading_pair: request.market,
    trade_type: request.side.toUpperCase(),
    amount: Number(request.quantity),
    order_type: request.orderType.toUpperCase(),
    ...(request.price === undefined ? {} : { price: Number(request.price) }),
  };
}

function fromHummingbotTradeResponse(requestId: string, body: unknown): ExecutionResult {
  if (!isRecord(body) || typeof body.order_id !== 'string' || typeof body.status !== 'string') {
    throw new BoundaryError({
      code: 'PROVIDER_PROTOCOL_ERROR',
      operation: 'execute-order',
      message: 'Hummingbot returned an invalid trade response',
      retryable: false,
    });
  }
  const status = normalizeStatus(body.status);
  return { requestId, providerOrderId: body.order_id, status };
}

function normalizeStatus(status: string): ExecutionResult['status'] {
  switch (status.toLowerCase()) {
    case 'submitted':
    case 'accepted':
      return status.toLowerCase() as 'submitted' | 'accepted';
    case 'rejected':
      return 'rejected';
    case 'failed':
      return 'failed';
    default:
      throw new BoundaryError({
        code: 'PROVIDER_PROTOCOL_ERROR',
        operation: 'execute-order',
        message: `Hummingbot returned unsupported order status ${status}`,
        retryable: false,
      });
  }
}

function mapHttpFailure(request: AxodusExecutionRequest, response: HummingbotHttpTransportResponse): BoundaryError {
  const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
  return new BoundaryError({
    code: retryable ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REJECTED',
    operation: 'execute-order',
    message: `Hummingbot rejected the execution request with HTTP ${response.status}`,
    retryable,
    upstreamStatus: response.status,
    upstreamCode: readUpstreamCode(response.body),
  });
}

function mapTransportFailure(_request: AxodusExecutionRequest, error: unknown): BoundaryError {
  const message = error instanceof Error ? error.message : String(error);
  const timeout = /timeout|timed out|aborted/i.test(message);
  return new BoundaryError({
    code: 'PROVIDER_EXECUTION_UNKNOWN',
    operation: 'execute-order',
    message: timeout
      ? 'Hummingbot execution outcome is unknown after a transport timeout'
      : 'Hummingbot execution outcome is unknown after an HTTP transport failure',
    retryable: false,
  });
}

function readUpstreamCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  const code = body.code ?? body.error_code;
  return typeof code === 'string' ? code : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
