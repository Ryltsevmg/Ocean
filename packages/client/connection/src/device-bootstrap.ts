/** Local credential-home bootstrap without a network or administrator listener. */
import { Context, Service } from '@deepseek-ai/cordis'
import { DevicePairingPassword } from './device-pairing-password.ts'
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
  private readonly passwords: DevicePairingPassword

  /** @param ctx - Bootstrap plugin context with its injected credential provider. */
  constructor(ctx: Context) {
    super(ctx, 'deviceBootstrap')
    this.tokens = new DeviceTokens(ctx.credentials)
    this.passwords = new DevicePairingPassword(ctx.credentials)
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

  /**
   * Set or clear the pairing password in the local credential home.
   * @param password - New pairing password, 8 to 256 characters after trimming; `null` removes it.
   * @throws When the password is outside the rule (`DEVICE_PAIRING_PASSWORD_INVALID`), or the provider fails.
   */
  setPairingPassword(password: string | null): Promise<void> {
    return password === null ? this.passwords.clear() : this.passwords.set(password)
  }
}
