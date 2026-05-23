import type { TradingDbCliResult } from '../trading-db.js';

export class JsonOutput {
  render(result: TradingDbCliResult): string {
    return JSON.stringify(result.payload, null, 2);
  }
}
