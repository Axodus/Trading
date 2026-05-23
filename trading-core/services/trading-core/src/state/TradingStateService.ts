import type { TradingEvent } from '../../../../packages/trading-contracts/src/index.js';
import type { TradingEventRepository } from '../repositories/interfaces.js';
import { ExecutionStateService } from './ExecutionStateService.js';
import { PortfolioStateService } from './PortfolioStateService.js';
import { PositionStateService } from './PositionStateService.js';
import { ProviderStateService } from './ProviderStateService.js';
import { RuntimeStateService } from './RuntimeStateService.js';
import { TradingAuditService } from './TradingAuditService.js';

export interface TradingStateServiceDependencies {
  eventRepository?: TradingEventRepository;
  executionState?: ExecutionStateService;
  runtimeState?: RuntimeStateService;
  positionState?: PositionStateService;
  portfolioState?: PortfolioStateService;
  providerState?: ProviderStateService;
  audit?: TradingAuditService;
}

export class TradingStateService {
  readonly executionState: ExecutionStateService;
  readonly runtimeState: RuntimeStateService;
  readonly positionState: PositionStateService;
  readonly portfolioState: PortfolioStateService;
  readonly providerState: ProviderStateService;
  readonly audit: TradingAuditService;

  constructor(private readonly dependencies: TradingStateServiceDependencies = {}) {
    this.executionState = dependencies.executionState ?? new ExecutionStateService();
    this.runtimeState = dependencies.runtimeState ?? new RuntimeStateService();
    this.positionState = dependencies.positionState ?? new PositionStateService();
    this.portfolioState = dependencies.portfolioState ?? new PortfolioStateService();
    this.providerState = dependencies.providerState ?? new ProviderStateService();
    this.audit = dependencies.audit ?? new TradingAuditService();
  }

  async applyEvent(event: TradingEvent): Promise<void> {
    await this.dependencies.eventRepository?.append(event);
    this.audit.recordEvent(event);
    this.executionState.applyEvent(event);
    this.runtimeState.applyEvent(event);
    this.providerState.applyEvent(event);
  }
}
