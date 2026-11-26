/** Forward a port of a remote Host to this computer's loopback. */
import { once } from 'node:events'
import { createServer, type Server, type Socket } from 'node:net'
import { ClientUplinkQueue, openDeviceStreamSocket, RemoteStreamMuxClient } from '@ocean/ocean-api-gateway/device'
import type { DeviceClient } from '@ocean/ocean-client-connection/device'

/** The Host stream that tunnels one TCP connection. */
export const PORT_FORWARD_ENDPOINT = 'portForward/open'

/** One forwarded Host port and the loopback listener that reaches it. */
export interface PortForward {
  /** Loopback port that reaches the Host port. */
  readonly port: number
  /** Stop the listener and every tunnel it accepted; each tunnel ends on the Host as well. */
  close(): Promise<void>
}

/** What the forward needs from the Host's stream multiplexer. */
export interface StreamOpener {
  start(): void
  open(
    endpoint: string,
    request: { args: { request: { port: number } } },
    signal: AbortSignal,
    uplink: ClientUplinkQueue,
  ): AsyncIterable<unknown>
  close(): Promise<void>
}

/** A multiplexer over an authenticated socket of the Host; each tunnel opens its own. */
export type StreamOpenerFactory = (client: Pick<DeviceClient, 'openSocket'>) => StreamOpener

/** The production factory: the Host's stream socket, authenticated with the device cookie. */
export const openHostStreams: StreamOpenerFactory = client =>
  new RemoteStreamMuxClient(path => client.openSocket(path, openDeviceStreamSocket))

export interface ForwardOptions {
  /** Loopback port to listen on; defaults to the Host port. Zero picks a free port. */
  readonly listen?: number
  /** Multiplexer factory; a test supplies its own. */
  readonly streams?: StreamOpenerFactory
  /** Ends the forward and its tunnels when aborted. */
  readonly signal: AbortSignal
}

const UNEXPECTED_FRAME = 'port forward: the Host sent an unexpected frame'

/** The frame types of the Host's `portForward/open` stream; the fields of `data` and `failed` are checked where used. */
interface HostFrame {
  readonly type: 'connected' | 'data' | 'end' | 'failed'
  readonly data?: unknown
  readonly message?: unknown
}

function isHostFrame(value: unknown): value is HostFrame {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  const { type } = value
  return type === 'connected' || type === 'data' || type === 'end' || type === 'failed'
}

/**
 * Follow one connection's current Host, so a tunnel accepted after a route switch dials the new route.
 * @param connection - Open connection whose `host` a route switch replaces.
 * @returns A client view that resolves the Host at each use.
 */
export function currentHost(connection: { readonly host: Pick<DeviceClient, 'openSocket'> }): Pick<DeviceClient, 'openSocket'> {
  return {
    openSocket: <Socket>(path: string, connect: (url: URL, cookie: string) => Socket): Socket =>
      connection.host.openSocket(path, connect),
  }
}

/**
 * Listen on this computer's loopback and tunnel every connection to the same port on the Host.
 * @param client - Authenticated device client of the Host, or the connection that holds one.
 * @param port - Port on the Host's loopback.
 * @param options - Local port, multiplexer factory, and cancellation.
 * @returns The forward once the listener accepts connections.
 * @throws The listener's error, such as a port already in use.
 */
export async function forwardHostPort(client: Pick<DeviceClient, 'openSocket'>, port: number, options: ForwardOptions): Promise<PortForward> {
  const streams = options.streams ?? openHostStreams
  const ended = new AbortController()
  const signal = AbortSignal.any([options.signal, ended.signal])
  const sockets = new Set<Socket>()
  const tunnels = new Set<Promise<void>>()
  // A client that ends its half still receives the Host's output until the Host ends its own.
  const server: Server = createServer({ allowHalfOpen: true }, (socket) => {
    const tunnel = accept(socket).finally(() => { tunnels.delete(tunnel) })
    tunnels.add(tunnel)
  })

  async function accept(socket: Socket): Promise<void> {
    sockets.add(socket)
    const closed = new AbortController()
    // The failure that destroys this socket, or a reset peer, reaches the tunnel through `close`; nothing else acts on it.
    socket.on('error', () => { socket.destroy() })
    socket.on('close', () => { sockets.delete(socket); closed.abort() })
    const opener = streams(client)
    const uplink = new ClientUplinkQueue(PORT_FORWARD_ENDPOINT)
    opener.start()
    try {
      // The generated descriptor names its one parameter `request`, and the Gateway rejects any other field.
      const tunnelSignal = AbortSignal.any([signal, closed.signal])
      for await (const frame of opener.open(PORT_FORWARD_ENDPOINT, { args: { request: { port } } }, tunnelSignal, uplink)) {
        if (!isHostFrame(frame)) throw new Error(UNEXPECTED_FRAME)
        if (frame.type === 'connected') {
          socket.on('data', (chunk: Buffer) => { uplink.push({ type: 'data', data: chunk.toString('base64') }) })
          socket.on('end', () => { uplink.push({ type: 'end' }) })
          socket.resume()
        } else if (frame.type === 'data') {
          if (typeof frame.data !== 'string') throw new Error(UNEXPECTED_FRAME)
          // The Host's output waits for this socket before the stream delivers more.
          if (!socket.write(Buffer.from(frame.data, 'base64'))) await once(socket, 'drain', { signal: closed.signal })
        } else if (frame.type === 'end') {
          socket.end()
        } else {
          if (typeof frame.message !== 'string') throw new Error(UNEXPECTED_FRAME)
          socket.destroy(new Error(frame.message))
        }
      }
    } catch (error) {
      socket.destroy(error instanceof Error ? error : undefined)
    } finally {
      uplink.close()
      socket.destroy()
      await opener.close().catch(() => undefined)
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.listen ?? port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  let closing: Promise<void> | undefined
  const close = (): Promise<void> => closing ??= (async () => {
    ended.abort()
    for (const socket of sockets) socket.destroy()
    await Promise.allSettled([...tunnels])
    await new Promise<void>((resolve) => { server.close(() => { resolve() }) })
  })()
  // A forward requested for a selection that already ended closes at once.
  if (signal.aborted) await close()
  else signal.addEventListener('abort', () => { void close() }, { once: true })
  return { port: (server.address() as { port: number }).port, close }
}
