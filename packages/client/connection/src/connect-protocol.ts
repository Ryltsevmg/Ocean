/** API connection inputs shared by the Host and its clients. */
import type { Branded } from '@ocean/ocean-brand'

/** Stable identity of one credential home. */
export type HostId = string & Branded<'HostId'>
/** Identity of one running Host launch. */
export type HostEpoch = string & Branded<'HostEpoch'>

/** Identity returned by a compatible Host discovery response. */
export interface HostIdentity {
  readonly id: HostId
  readonly epoch: HostEpoch
}

/** Whether a Peer participates in forwarded human interactions. */
export type ConnectionInteractions = 'answer' | 'none'

/** Launch-token exchange route for API clients. */
export const CONNECT_PATH = '/connect'

/** Authenticated structured boot injections for a packaged desktop client. */
export const DEVICE_BOOTSTRAP_PATH = '/connect/bootstrap'

/** One-time pairing exchange: a short-lived grant becomes a device token. */
export const DEVICE_PAIR_PATH = '/connect/pair'

/** HTTP header selecting how `POST /connect/pair` reads its Authorization bearer; absent selects the pairing grant. */
export const DEVICE_PAIRING_HEADER = 'ocean-device-pairing'

/** Header value that selects password pairing, echoed by every reply to a request that selected it. */
export const DEVICE_PAIRING_PASSWORD = 'password'

/** HTTP header naming the label a device receives from password pairing, which carries no pre-assigned grant label. */
export const DEVICE_LABEL_HEADER = 'ocean-device-label'

/** Version of the device login and remote transport protocol. */
export const DEVICE_PROTOCOL_VERSION = '1'

/** HTTP header carrying the requested or supported device protocol version. */
export const DEVICE_PROTOCOL_HEADER = 'ocean-device-protocol'

/** Stable credential-home identity returned by discovery or supplied as a login precondition. */
export const DEVICE_HOST_HEADER = 'ocean-device-host'

/** Current Host launch epoch returned by discovery and authentication. */
export const DEVICE_EPOCH_HEADER = 'ocean-device-epoch'

/** Socket events consumed by the Gateway on browser and Node carriers. */
export interface ConnectionWebSocketEventMap {
  readonly open: object
  readonly error: object
  readonly close: object
  readonly message: { readonly data: unknown }
}

/** Text WebSocket operations shared by the browser API and Node carriers. */
export interface ConnectionWebSocket {
  /** Standard WebSocket state, from CONNECTING (0) through CLOSED (3). */
  readonly readyState: number
  /** @param data - complete text frame to send. */
  send(data: string): void
  /**
   * @param code - protocol close code.
   * @param reason - peer-facing close explanation.
   */
  close(code?: number, reason?: string): void
  /**
   * @param event - physical socket event.
   * @param listener - callback for that event.
   * @param options - whether the callback is removed after its first delivery.
   */
  addEventListener<Event extends keyof ConnectionWebSocketEventMap>(
    event: Event,
    listener: (event: ConnectionWebSocketEventMap[Event]) => void,
    options?: { readonly once?: boolean },
  ): void
  /**
   * @param event - physical socket event.
   * @param listener - previously registered callback.
   */
  removeEventListener<Event extends keyof ConnectionWebSocketEventMap>(
    event: Event,
    listener: (event: ConnectionWebSocketEventMap[Event]) => void,
  ): void
}

/**
 * Create an authenticated socket; its consumer owns framing and closing.
 * @param url - absolute WebSocket URL beneath the selected Host mount.
 * @returns a newly connecting socket, before it emits open or failure.
 */
export type ConnectionWebSocketFactory = (url: string) => ConnectionWebSocket
