export type AdmissibleEnvironment = 'testnet' | 'sandbox' | 'paper';

export interface ExternalSafetyPreflightConfig {
  environment: string;
  allowedInstruments: string[];
  maxOrderNotional: number;
  maxTotalRunNotional: number;
  maxOutstandingOrders: number;
  tenantId: string;
  runSessionId: string;
  killSwitchActive?: boolean;
}

export interface PreflightEvaluationRequest {
  config: ExternalSafetyPreflightConfig;
  order: {
    instrument: string;
    quantity: number;
    price: number;
    clientOrderId: string;
    tenantId: string;
    runSessionId: string;
  };
  currentRunState: {
    accumulatedNotional: number;
    activeOrders: Set<string>;
  };
  credentialScopes?: string[];
}

export interface PreflightEvaluationResult {
  passed: boolean;
  reason?: string;
  violationCode?:
    | 'ENVIRONMENT_REJECTED'
    | 'CREDENTIAL_FORBIDDEN_SCOPE'
    | 'INSTRUMENT_NOT_ALLOWED'
    | 'MAX_ORDER_NOTIONAL_EXCEEDED'
    | 'MAX_TOTAL_NOTIONAL_EXCEEDED'
    | 'MAX_OUTSTANDING_ORDERS_EXCEEDED'
    | 'DUPLICATE_CLIENT_ORDER_ID'
    | 'TENANT_MISMATCH'
    | 'RUN_SESSION_MISMATCH'
    | 'KILL_SWITCH_ACTIVE';
}

const ADMISSIBLE_ENVIRONMENTS = new Set<string>(['testnet', 'sandbox', 'paper']);
const FORBIDDEN_SCOPES_REGEX = /withdraw|withdrawal|transfer|universal_transfer/i;

export class TradingExternalSafetyPreflightPolicy {
  evaluate(request: PreflightEvaluationRequest): PreflightEvaluationResult {
    const { config, order, currentRunState, credentialScopes } = request;

    // 1. Environment Admission
    if (!ADMISSIBLE_ENVIRONMENTS.has(config.environment.toLowerCase())) {
      return {
        passed: false,
        reason: `Environment '${config.environment}' is not admitted for external preflight. Only testnet, sandbox, and paper are allowed.`,
        violationCode: 'ENVIRONMENT_REJECTED',
      };
    }

    // 2. Credential Capability Policy (Zero-withdrawal)
    if (credentialScopes && credentialScopes.length > 0) {
      for (const scope of credentialScopes) {
        if (FORBIDDEN_SCOPES_REGEX.test(scope)) {
          return {
            passed: false,
            reason: `Forbidden credential scope detected: '${scope}'. Withdrawals and transfers are strictly prohibited.`,
            violationCode: 'CREDENTIAL_FORBIDDEN_SCOPE',
          };
        }
      }
    }

    // 3. Kill Switch
    if (config.killSwitchActive) {
      return {
        passed: false,
        reason: 'Kill switch is active. Execution dispatch suspended.',
        violationCode: 'KILL_SWITCH_ACTIVE',
      };
    }

    // 4. Tenant & Run Correlation Ownership
    if (order.tenantId !== config.tenantId) {
      return {
        passed: false,
        reason: `Tenant mismatch: order tenant '${order.tenantId}' does not match preflight config tenant '${config.tenantId}'.`,
        violationCode: 'TENANT_MISMATCH',
      };
    }

    if (order.runSessionId !== config.runSessionId) {
      return {
        passed: false,
        reason: `Run session mismatch: order session '${order.runSessionId}' does not match active preflight session '${config.runSessionId}'.`,
        violationCode: 'RUN_SESSION_MISMATCH',
      };
    }

    // 5. Instrument Allowlist
    if (!config.allowedInstruments.includes(order.instrument)) {
      return {
        passed: false,
        reason: `Instrument '${order.instrument}' is not on the admitted preflight allowlist.`,
        violationCode: 'INSTRUMENT_NOT_ALLOWED',
      };
    }

    // 6. Hard Limits: Order Notional
    const orderNotional = order.quantity * order.price;
    if (orderNotional > config.maxOrderNotional) {
      return {
        passed: false,
        reason: `Order notional ${orderNotional} exceeds maximum allowed order ceiling of ${config.maxOrderNotional}.`,
        violationCode: 'MAX_ORDER_NOTIONAL_EXCEEDED',
      };
    }

    // 7. Hard Limits: Total Run Notional
    if (currentRunState.accumulatedNotional + orderNotional > config.maxTotalRunNotional) {
      return {
        passed: false,
        reason: `Accumulated run notional ${currentRunState.accumulatedNotional + orderNotional} exceeds maximum run ceiling of ${config.maxTotalRunNotional}.`,
        violationCode: 'MAX_TOTAL_NOTIONAL_EXCEEDED',
      };
    }

    // 8. Hard Limits: Outstanding Orders
    if (currentRunState.activeOrders.size >= config.maxOutstandingOrders) {
      return {
        passed: false,
        reason: `Active outstanding orders count ${currentRunState.activeOrders.size} reached the maximum allowed limit of ${config.maxOutstandingOrders}.`,
        violationCode: 'MAX_OUTSTANDING_ORDERS_EXCEEDED',
      };
    }

    // 9. Duplicate / Active Replay Protection
    if (currentRunState.activeOrders.has(order.clientOrderId)) {
      return {
        passed: false,
        reason: `Duplicate active clientOrderId detected: '${order.clientOrderId}'.`,
        violationCode: 'DUPLICATE_CLIENT_ORDER_ID',
      };
    }

    return {
      passed: true,
    };
  }

  performDeterministicCleanup(activeOrders: Set<string>): {
    ordersToCancel: string[];
    cleanupCompleted: boolean;
  } {
    const ordersToCancel = Array.from(activeOrders);
    activeOrders.clear();
    return {
      ordersToCancel,
      cleanupCompleted: true,
    };
  }
}

