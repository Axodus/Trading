import type { WhiteRabbitExecutionProfile as WhiteRabbitExecutionProfileContract } from '../../../../../packages/trading-contracts/src/index.js';

export const whiteRabbitExecutionProfile: WhiteRabbitExecutionProfileContract = {
  strategyId: 'whiterabbit-v1',
  strategyProductId: 'whiterabbit-scalper-futures',
  executionMode: 'paper',
  simulationFirst: true,
  productionMutationAllowed: false,
  supportedLifecycle: [
    'provisioning',
    'simulation',
    'paper-validation',
    'controlled-execution-proposal',
    'pause',
    'resume',
    'degrade',
  ],
};
