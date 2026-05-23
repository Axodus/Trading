import type {
  WhiteRabbitSurfaceResponse,
} from '../../../../../packages/trading-contracts/src/index.js';
import type { WhiteRabbitSurfaceInput } from './WhiteRabbitProductSurfaceService.js';
import { WhiteRabbitProductSurfaceService } from './WhiteRabbitProductSurfaceService.js';
import { WhiteRabbitQuotaViewService } from './WhiteRabbitQuotaViewService.js';
import { WhiteRabbitTelemetrySummaryService } from './WhiteRabbitTelemetrySummaryService.js';

export class WhiteRabbitQueryService {
  constructor(
    private readonly surface = new WhiteRabbitProductSurfaceService(),
    private readonly telemetry = new WhiteRabbitTelemetrySummaryService(),
    private readonly quota = new WhiteRabbitQuotaViewService(),
  ) {}

  query(input: WhiteRabbitSurfaceInput): WhiteRabbitSurfaceResponse {
    const surface = this.surface.build(input);
    const quota = this.quota.build(surface.runtime);
    const providerId = input.runtime?.providerId ?? input.credentialBinding?.exchange;
    const supportedProviders = input.product?.supportedProviders ?? ['simulation', 'hummingbot'];
    const blockers = [
      ...surface.runtime.runtimeEnablement.blockers,
      ...surface.access.reasons,
    ];

    return {
      ...surface,
      telemetry: this.telemetry.summarize(surface.telemetry),
      quota,
      providerCompatibility: {
        supportedProviders,
        selectedProvider: providerId,
        compatible: providerId ? supportedProviders.some((supportedProvider) => supportedProvider === providerId) : false,
      },
      readiness: {
        simulationReady: surface.access.accessStatus !== 'blocked',
        paperReady: surface.runtime.runtimeEnablement.canEnableExecution,
        blockers,
      },
    };
  }
}
