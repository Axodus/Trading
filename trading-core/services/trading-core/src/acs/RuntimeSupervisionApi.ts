import type {
  AcsTradingCommand,
  RuntimeSupervisionDecision,
} from '../../../../packages/trading-contracts/src/index.js';
import { AcsTradingCommandApi } from './AcsTradingCommandApi.js';

export class RuntimeSupervisionApi {
  constructor(private readonly commands: AcsTradingCommandApi) {}

  async request(command: AcsTradingCommand): Promise<RuntimeSupervisionDecision> {
    const decision = await this.commands.submit(command);
    return {
      ...decision,
      commandType: command.commandType,
      mutatesRuntime: false,
    };
  }
}
