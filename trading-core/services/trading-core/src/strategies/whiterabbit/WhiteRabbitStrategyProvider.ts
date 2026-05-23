import type { StrategySignal } from '../../../../../packages/trading-contracts/src/index.js';
import { WhiteRabbitProductAdapter } from './WhiteRabbitProductAdapter.js';
import { whiteRabbitExecutionProfile } from './WhiteRabbitExecutionProfile.js';
import { WhiteRabbitRuntimeEngine } from './WhiteRabbitRuntimeEngine.js';
import { whiteRabbitTelemetryProfile } from './WhiteRabbitTelemetryProfile.js';

export class WhiteRabbitStrategyProvider {
  readonly strategyId = 'whiterabbit-v1';
  readonly product = new WhiteRabbitProductAdapter().toStrategyProduct();
  readonly executionProfile = whiteRabbitExecutionProfile;
  readonly telemetryProfile = whiteRabbitTelemetryProfile;

  createRuntimeEngine(): WhiteRabbitRuntimeEngine {
    return new WhiteRabbitRuntimeEngine();
  }

  createHoldSignal(generatedAt = new Date().toISOString()): StrategySignal {
    return {
      id: `signal-${this.strategyId}-${generatedAt}`,
      strategyId: this.strategyId,
      action: 'hold',
      confidence: 1,
      generatedAt,
    };
  }

  supportsTreasuryExecution(): boolean {
    return true;
  }

  supportsUserProductExecution(): boolean {
    return true;
  }
}
