import type { PaperConnectorConfig, PaperTradingSessionPolicy } from '../../../../../packages/trading-contracts/src/index.js';

const FORBIDDEN_SCOPE_PATTERN = /withdraw|withdrawal|transfer/i;

export class PaperConnectorConfigValidator {
  validate(config: PaperConnectorConfig, policy: PaperTradingSessionPolicy): { approved: boolean; reason?: string } {
    if (config.mode !== 'paper' && config.mode !== 'backtest') {
      return { approved: false, reason: 'Paper session rejected live execution mode.' };
    }
    if (!policy.allowedProviders.includes(config.providerType)) {
      return { approved: false, reason: `Provider type is not allowed for paper session: ${config.providerType}` };
    }
    if (config.providerType === 'simulation' && !policy.allowSimulation) {
      return { approved: false, reason: 'Simulation paper sessions are disabled by policy.' };
    }
    if (config.providerType === 'hummingbot' && !policy.allowHummingbotPaper) {
      return { approved: false, reason: 'Hummingbot paper sessions are disabled by policy.' };
    }
    if (Object.hasOwn(config as object, 'rawApiKey') || Object.hasOwn(config as object, 'rawApiSecret')) {
      return { approved: false, reason: 'Paper session config must not include raw API credentials.' };
    }
    if (config.credentialScopes?.some((scope) => FORBIDDEN_SCOPE_PATTERN.test(scope))) {
      return { approved: false, reason: 'Paper session credential scopes must not include withdrawal permissions.' };
    }
    if (policy.requireCredentialBinding && !config.vaultRefId && config.providerType !== 'simulation') {
      return { approved: false, reason: 'Paper session requires credential vault reference for this provider.' };
    }
    return { approved: true };
  }
}
