import type { ExecutionIntent } from '../application/ExecutionIntent.js';
import { EntitlementEvaluator } from './EntitlementEvaluator.js';
import { RuntimeQuotaEvaluator } from './RuntimeQuotaEvaluator.js';
import type { ProductAccessState } from './StrategyAccessService.js';
import { StrategyAccessService } from './StrategyAccessService.js';
import { TokenGateEvaluator } from './TokenGateEvaluator.js';

export interface GateDecision {
  approved: boolean;
  reason?: string;
}

export interface ProductExecutionGateOptions {
  accessService?: StrategyAccessService;
  tokenGateEvaluator?: TokenGateEvaluator;
  entitlementEvaluator?: EntitlementEvaluator;
  runtimeQuotaEvaluator?: RuntimeQuotaEvaluator;
  approveByDefault?: boolean;
}

export class ProductExecutionGate {
  private readonly accessService?: StrategyAccessService;
  private readonly tokenGateEvaluator: TokenGateEvaluator;
  private readonly entitlementEvaluator: EntitlementEvaluator;
  private readonly runtimeQuotaEvaluator?: RuntimeQuotaEvaluator;
  private readonly approveByDefault: boolean;

  constructor(options: ProductExecutionGateOptions | ProductAccessState | boolean = false) {
    if (typeof options === 'boolean') {
      this.approveByDefault = options;
      this.tokenGateEvaluator = new TokenGateEvaluator();
      this.entitlementEvaluator = new EntitlementEvaluator();
      return;
    }

    const hasExplicitOptions = 'accessService' in options
      || 'tokenGateEvaluator' in options
      || 'entitlementEvaluator' in options
      || 'runtimeQuotaEvaluator' in options
      || 'approveByDefault' in options;
    const accessService = hasExplicitOptions
      ? (options as ProductExecutionGateOptions).accessService
      : new StrategyAccessService(options as ProductAccessState);
    this.accessService = accessService;
    this.tokenGateEvaluator = ('tokenGateEvaluator' in options && options.tokenGateEvaluator) || new TokenGateEvaluator();
    this.entitlementEvaluator = ('entitlementEvaluator' in options && options.entitlementEvaluator) || new EntitlementEvaluator();
    this.runtimeQuotaEvaluator = ('runtimeQuotaEvaluator' in options && options.runtimeQuotaEvaluator)
      || (accessService ? new RuntimeQuotaEvaluator(accessService) : undefined);
    this.approveByDefault = ('approveByDefault' in options && options.approveByDefault) || false;
  }

  async authorize(intent: ExecutionIntent): Promise<GateDecision> {
    if (intent.context.executionDomain !== 'user') {
      return { approved: true };
    }

    if (this.accessService) {
      return this.authorizeUserExecution(intent);
    }

    if (!this.approveByDefault) {
      return { approved: false, reason: 'User execution requires product entitlement approval' };
    }

    return { approved: true };
  }

  private authorizeUserExecution(intent: ExecutionIntent): GateDecision {
    const userId = intent.context.userId;
    const strategyProductId = intent.context.strategyProductId;
    const runtimeInstanceId = intent.context.runtimeInstanceId;
    if (!userId || !strategyProductId || !runtimeInstanceId) {
      return { approved: false, reason: 'User execution requires user, strategy product, and runtime context' };
    }

    const product = this.accessService?.getStrategyProduct(strategyProductId);
    const profile = this.accessService?.getUserProfile(userId);
    const runtime = this.accessService?.getRuntimeInstance(runtimeInstanceId);
    if (!product || !profile || !runtime) {
      return { approved: false, reason: 'Product access context is incomplete' };
    }

    if (product.lifecycleStatus !== 'active') {
      return { approved: false, reason: `Strategy product is not active: ${product.lifecycleStatus}` };
    }

    if (product.visibility === 'dao-only') {
      const daoId = intent.context.daoId;
      if (!daoId || !this.accessService?.isDaoMember(userId, daoId)) {
        return { approved: false, reason: 'DAO-only strategy requires DAO membership' };
      }
    }

    const entitlementDecision = this.entitlementEvaluator.evaluate(product, profile);
    if (!entitlementDecision.approved) {
      return entitlementDecision;
    }

    const tokenDecision = this.tokenGateEvaluator.evaluate(product, profile);
    if (!tokenDecision.approved) {
      return tokenDecision;
    }

    const quotaDecision = this.runtimeQuotaEvaluator?.evaluate(product, profile, runtime);
    if (quotaDecision && !quotaDecision.approved) {
      return quotaDecision;
    }

    return { approved: true };
  }
}
