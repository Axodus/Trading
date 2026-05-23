import type { ExecutionFill, ExecutionRequest, ExecutionResult } from '../../../../../../packages/trading-contracts/src/index.js';
import { SimulationRuntime } from './SimulationRuntime.js';

export interface SimulationExecutionEngineOptions {
  deterministicPrice?: string;
}

export class SimulationExecutionEngine {
  constructor(
    private readonly runtime: SimulationRuntime,
    private readonly options: SimulationExecutionEngineOptions = {},
  ) {}

  execute(request: ExecutionRequest): ExecutionResult {
    const providerOrderId = `sim-${request.requestId}`;
    const price = request.price ?? this.options.deterministicPrice ?? '100';
    const fill: ExecutionFill = {
      fillId: `fill-${request.requestId}`,
      providerOrderId,
      market: request.market,
      side: request.side,
      quantity: request.quantity,
      price,
      filledAt: new Date().toISOString(),
    };

    this.runtime.applyFill({
      market: request.market,
      side: request.side,
      quantity: Number(request.quantity),
      price: Number(price),
    });

    return {
      requestId: request.requestId,
      providerOrderId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      fills: [fill],
    };
  }
}
