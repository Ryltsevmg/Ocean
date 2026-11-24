/** Local credential-home bootstrap without a network or administrator listener. */
import { Context, Service } from '@deepseek-ai/cordis'
import { DeviceTokens, type DeviceId, type DeviceMetadata } from './device-tokens.ts'
import type { DeviceScope } from './device-scopes.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Local-only device issuance and inventory for the bootstrap profile. */
    deviceBootstrap: DeviceBootstrap
  }
}

/** Uses the selected credential provider's serialization and file-access policy. */
export class DeviceBootstrap extends Service {
  private readonly tokens: DeviceTokens

  /** @param ctx - Bootstrap plugin context with its injected credential provider. */
  constructor(ctx: Context) {
    super(ctx, 'deviceBootstrap')
    this.tokens = new DeviceTokens(ctx.credentials)
  }

  /**
   * Create a device in the local credential home without exposing a listener.
   * @param label - User-visible name for the device.
   * @param scopes - Rights the device receives; absent grants every scope.
   * @returns The device identifier and its token, shown once after the write commits.
   */
  issue(label: string, scopes?: readonly DeviceScope[]): Promise<{ id: DeviceId; token: string }> {
    return this.tokens.issue(label, scopes)
  }

  /**
   * Read local device metadata without credential material.
   * @returns The credential provider's current device inventory.
   */
  list(): Promise<DeviceMetadata[]> {
    return this.tokens.list()
  }
}
