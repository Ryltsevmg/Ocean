/**
 * Wire types of the generated `portForward` Remote namespace: one TCP connection
 * to a port on the Host's loopback interface, carried as base64 frames in both
 * directions. Client-safe: no Host imports, so the same declarations reach the
 * browser half unchanged.
 * @module @ocean/ocean-api-port-forward-controller/types
 */

/** Argument of `portForward.open`. */
export interface PortForwardRequest {
  /** Port on this Host's loopback interface to connect to; an integer from 1 to 65535. */
  readonly port: number
}

/** Why a connection was not established, or broke after it was. */
export type PortForwardFailureCode =
  /** Nothing listens on the port (`ECONNREFUSED`). */
  | 'refused'
  /** The connection attempt failed for any other reason, or an established connection broke without a FIN. */
  | 'unreachable'
  /** Reserved for a Client-side cap on forwarded ports; the Host never emits it. */
  | 'limit'

/**
 * Downstream frame (Host → Client) of one `portForward.open` stream. `connected`
 * comes first, `data` frames follow as the port sends bytes, and `end` or
 * `failed` is the last frame of the stream.
 */
export type PortForwardFrame =
  | { readonly type: 'connected'; readonly port: number }
  /** `data` is base64 of at most 64 KiB of raw bytes. */
  | { readonly type: 'data'; readonly data: string }
  /** The port closed its end of the connection. */
  | { readonly type: 'end' }
  /** The stream ends after this frame. */
  | { readonly type: 'failed'; readonly code: PortForwardFailureCode; readonly message: string }

/** Upstream item (Client → Host) of one `portForward.open` stream. */
export type PortForwardInput =
  /** `data` is base64 of the bytes to write to the port. */
  | { readonly type: 'data'; readonly data: string }
  /** The Client closed its half of the connection; the Host calls `socket.end()`. */
  | { readonly type: 'end' }

declare module '@ocean/ocean-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The requested port is not an integer from 1 to 65535. */
    'port-forward/invalid-port': { readonly port: number }
  }
}
