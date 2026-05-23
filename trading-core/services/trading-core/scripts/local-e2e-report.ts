import {
  formatTradingLocalE2eReport,
  type TradingLocalE2eReport,
} from '../../../../dist/services/trading-core/services/trading-core/src/index.js';

export function printLocalE2eReport(report: TradingLocalE2eReport, json: boolean): void {
  process.stdout.write(`${formatTradingLocalE2eReport(report, json)}\n`);
}

