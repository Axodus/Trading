import type { PaperRiskEvaluationInput, PaperRiskSignal } from '../../../../../packages/trading-contracts/src/index.js';
import { PaperExecutionQualityEvaluator } from './PaperExecutionQualityEvaluator.js';
import { PaperSessionHealthEvaluator } from './PaperSessionHealthEvaluator.js';

export class PaperSessionRiskSignalService {
  constructor(
    private readonly quality = new PaperExecutionQualityEvaluator(),
    private readonly health = new PaperSessionHealthEvaluator(),
  ) {}

  createSignals(input: PaperRiskEvaluationInput): PaperRiskSignal[] {
    return [
      ...this.quality.evaluate(input),
      ...this.health.evaluate(input),
    ];
  }
}

