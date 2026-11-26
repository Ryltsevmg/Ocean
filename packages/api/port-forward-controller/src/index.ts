/**
 * Host owner of the `portForward` Remote namespace: one open stream is one TCP
 * connection to a port on this Host's loopback interface, carrying bytes in both
 * directions as base64 frames. No other address than `127.0.0.1` is ever
 * connected. The Gateway's `remote-device` policy admits `portForward/open` under
 * `terminal:operate` only, because reaching a Host port means reaching a service
 * the Host runs; the Gateway's per-socket stream limit bounds concurrency.
 * @module @ocean/ocean-api-port-forward-controller
 */

import { Context } from '@deepseek-ai/cordis'
import { createConnection, type Socket } from 'node:net'
import { Remote, RemoteError, TypertRemoteService, type RemoteStream } from '@ocean/ocean-typert-protocol'
import type { PortForwardFailureCode, PortForwardFrame, PortForwardInput, PortForwardRequest } from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `portForward` Remote namespace. */
    portForwardController: PortForwardController
  }
}

/** The only address a stream reaches: this Host's loopback interface. */
const LOOPBACK_HOST = '127.0.0.1'
/** Largest port number IP carries. */
const MAX_PORT = 65535
/** Raw bytes in one downlink `data` frame. */
const MAX_FRAME_BYTES = 64 * 1024

/** Host service backing the generated `ctx.remote.portForward` namespace. */
export class PortForwardController extends TypertRemoteService {
  /**
   * Without a Typert registry there is no Remote stack to serve, so the service
   * stays unactivated rather than failing the composition at load.
   */
  static inject = ['typert']

  /** @param ctx - Host context. */
  constructor(ctx: Context) {
    super(ctx, 'portForwardController', { namespace: 'portForward' })
  }

  /**
   * Connect `127.0.0.1:<port>` on this Host and relay bytes both ways. The
   * stream reports `connected`, then every byte the port sends as base64 `data`
   * frames as they arrive, and ends with `end` when the port closes its end or
   * `failed` when the connection is refused or breaks. Client `data` items are
   * written to the socket in order, waiting for the socket to drain before the
   * next item whenever the port reads slowly; a Client `end` item, or the Client
   * ending its uplink, half-closes the socket. Cancelling the stream destroys
   * the socket.
   * @param request - loopback port of this Host.
   * @param signal - carrier cancellation; destroys the socket.
   * @returns the downlink frames in wire order.
   * @throws RemoteError `port-forward/invalid-port` for a port outside 1…65535.
   */
  @Remote({ mode: 'stream' })
  open(request: PortForwardRequest, signal: AbortSignal): RemoteStream<PortForwardFrame, PortForwardInput> {
    signal.throwIfAborted()
    const { port } = request
    if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
      throw new RemoteError(
        'port-forward/invalid-port',
        `Port forwarding requires an integer port from 1 to ${String(MAX_PORT)}, got ${String(port)}`,
        { port },
      )
    }
    const invocation = this.ctx.invocation
    if (invocation === undefined) throw new Error('Port forwarding requires a Remote invocation')
    return relay(invocation.uplink<PortForwardInput>(), port, signal)
  }
}

export default PortForwardController

/**
 * Carry one loopback TCP connection over the stream until either side closes it.
 * @param uplink - the Client's items: base64 `data` to write, and `end` to half-close.
 * @param port - validated loopback port.
 * @param signal - carrier cancellation; destroys the socket, which ends every wait below.
 * @returns the downlink frames in wire order.
 */
async function* relay(uplink: AsyncIterable<PortForwardInput>, port: number, signal: AbortSignal): AsyncIterable<PortForwardFrame> {
  const socket = createConnection({ host: LOOPBACK_HOST, port })
  // Recorded from creation on, so a socket error never reaches the process as an uncaught event.
  let socketError: Error | undefined
  socket.on('error', (error) => { socketError = error })
  const destroy = (): void => { socket.destroy() }
  signal.addEventListener('abort', destroy, { once: true })
  // The socket queues writes until it connects, so Client bytes move without a downlink read driving them.
  const input = uplink[Symbol.asyncIterator]()
  // A rejected uplink read is the Gateway failing or cancelling the stream, which destroys the socket through the signal.
  const writing = writeInput(socket, input).catch(() => undefined)
  try {
    const failure = await connected(socket, () => socketError)
    if (cancelled(signal)) return
    if (failure !== undefined) {
      yield failure
      return
    }
    yield { type: 'connected', port }
    try {
      for await (const chunk of socket as AsyncIterable<Buffer>) yield* framesOf(chunk)
    } catch (error) {
      // The Gateway rejects the consumer with `gateway/cancelled` on abort, so a frame yielded here is discarded.
      yield failed('unreachable', error)
      return
    }
    yield { type: 'end' }
  } finally {
    signal.removeEventListener('abort', destroy)
    socket.destroy()
    // Returning the uplink wakes a pump blocked on its next item before the pump is joined.
    await input.return?.()
    await writing
  }
}

/**
 * @param signal - carrier signal.
 * @returns whether the carrier was cancelled. A helper, because TypeScript keeps `aborted`
 * narrowed to `false` after the first check inside one function.
 */
function cancelled(signal: AbortSignal): boolean {
  return signal.aborted
}

/**
 * Settle the connection phase. A connect error is emitted before the `close` it
 * causes, so `close` observes it.
 * @param socket - connecting socket; its `error` events are recorded by the caller.
 * @param errorOf - reads the error recorded so far.
 * @returns `undefined` once connected, else the `failed` frame for the error that closed the socket.
 */
function connected(socket: Socket, errorOf: () => Error | undefined): Promise<PortForwardFrame | undefined> {
  return new Promise((resolve) => {
    const settle = (frame: PortForwardFrame | undefined): void => {
      socket.off('connect', onConnect)
      socket.off('close', onClose)
      resolve(frame)
    }
    const onConnect = (): void => { settle(undefined) }
    const onClose = (): void => { settle(connectFailure(errorOf())) }
    socket.once('connect', onConnect)
    socket.once('close', onClose)
  })
}

/**
 * @param error - the error that closed the connecting socket, if it emitted one.
 * @returns `refused` when nothing listened on the port, `unreachable` for every other outcome.
 */
function connectFailure(error: Error | undefined): PortForwardFrame {
  if (error === undefined) return failed('unreachable', new Error('The connection closed before it was established'))
  return failed((error as NodeJS.ErrnoException).code === 'ECONNREFUSED' ? 'refused' : 'unreachable', error)
}

/**
 * Write the Client's items to the socket in order, waiting for `drain` whenever
 * the socket cannot take more yet, and half-close the socket once the Client
 * ends its side. A socket that was destroyed takes nothing further, so the pump
 * stops at the next item instead of waiting for a `drain` that never comes.
 * @param socket - the stream's socket, connecting or connected.
 * @param input - the Client's uplink items.
 */
async function writeInput(socket: Socket, input: AsyncIterator<PortForwardInput>): Promise<void> {
  while (true) {
    const next = await input.next()
    const item: PortForwardInput = next.done === true ? { type: 'end' } : next.value
    // The Client's own `end()` closes its half the same way an `end` item does.
    if (item.type === 'end') {
      socket.end()
      return
    }
    if (socket.destroyed) return
    if (!socket.write(Buffer.from(item.data, 'base64'))) await drained(socket)
  }
}

/**
 * @param socket - socket whose write buffer is full.
 * @returns resolves on the next `drain`, or when the socket closes before that.
 */
function drained(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      socket.off('drain', settle)
      socket.off('close', settle)
      resolve()
    }
    socket.on('drain', settle)
    socket.on('close', settle)
  })
}

/**
 * @param chunk - bytes the port sent.
 * @returns the chunk as `data` frames of at most MAX_FRAME_BYTES raw bytes, in order.
 */
function* framesOf(chunk: Buffer): Generator<PortForwardFrame> {
  for (let offset = 0; offset < chunk.length; offset += MAX_FRAME_BYTES) {
    yield { type: 'data', data: chunk.subarray(offset, offset + MAX_FRAME_BYTES).toString('base64') }
  }
}

/**
 * @param code - why the connection is unusable.
 * @param error - the failure whose message the frame reports.
 * @returns the terminal `failed` frame.
 */
function failed(code: PortForwardFailureCode, error: unknown): PortForwardFrame {
  return { type: 'failed', code, message: error instanceof Error ? error.message : String(error) }
}
