/** Main-process transport for one authenticated remote Host. */
import { DeviceClient } from '@ocean/ocean-client-connection/device'
import { forwardWebRequest } from './web-document.ts'
import { desktopClientRelease } from './client-metadata.ts'
import { assertRemoteBootstrapRelease } from './remote-bootstrap.ts'

/** A connection can be published to the application window after obtaining its boot data. */
export class RemoteDesktopHost {
  private constructor(
    private readonly client: DeviceClient,
    readonly address: string,
    readonly hostId: string,
    readonly injections: readonly unknown[],
  ) {}

  /**
   * Authenticate and obtain device-scoped boot data before publishing the connection.
   * @param address - User-selected HTTPS Host mount.
   * @param token - Device token, retained only by the caller.
   * @param signal - Cancellation for startup.
   * @param expectedHostId - Identity pinned by a saved connection.
   * @returns Authenticated transport with the renderer's boot data.
   */
  static async connect(address: string, token: string, signal: AbortSignal, expectedHostId?: string): Promise<RemoteDesktopHost> {
    const release = desktopClientRelease()
    const client = new DeviceClient(address)
    const identity = await client.login(token, signal, expectedHostId)
    try {
      const injections = await client.bootstrap(signal)
      assertRemoteBootstrapRelease(injections, release)
      return new RemoteDesktopHost(client, client.transportCredentials().address, identity.id, injections)
    } catch (error) {
      try { await client.logout(AbortSignal.timeout(5_000)) } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Remote Host bootstrap failed and logout could not be confirmed')
      }
      throw error
    }
  }

  /** Main-process credentials for HTTP and WebSocket forwarding. */
  get transport(): { address: string; cookie: string } { return this.client.transportCredentials() }

  /**
   * Forward one request to the authenticated remote Host.
   * @param request - Request from the application document.
   * @returns Host response stripped of credentials and redirects.
   */
  forward(request: Request): Promise<Response> {
    const { address, cookie } = this.transport
    return forwardWebRequest(request, address, cookie, true)
  }

  /**
   * Revoke the login and discard its local credentials.
   * @param signal - Cancellation for the logout request.
   * @returns Completion of logout, or a failure if the server did not confirm it.
   */
  close(signal: AbortSignal): Promise<void> { return this.client.logout(signal) }
}
