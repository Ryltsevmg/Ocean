/** A forwarded Host port carries bytes both ways over one stream per connection. */
import { connect, type Socket } from 'node:net'
import { expect, it, vi } from 'vitest'
import { DeviceClient } from '@ocean/ocean-client-connection/device'
import { currentHost, forwardHostPort, PORT_FORWARD_ENDPOINT, type StreamOpener } from '../src/remote-port-forward.ts'

/** A controllable Host stream: the test feeds frames and reads what the client sent. */
class FakeHost {
  readonly opened: { request: { port: number } }[] = []
  readonly sent: unknown[] = []
  closed = 0
  private readonly waiting: ((item: IteratorResult<unknown>) => void)[] = []
  private readonly ready: unknown[] = []

  readonly opener: StreamOpener = {
    start: () => undefined,
    open: (endpoint, request, signal, uplink) => {
      expect(endpoint).toBe(PORT_FORWARD_ENDPOINT)
      this.opened.push(request.args)
      void (async () => { for await (const item of uplink) this.sent.push(item) })()
      return (async function* (host: FakeHost): AsyncGenerator {
        const aborted = new Promise<never>((_resolve, reject) => {
          signal.addEventListener('abort', () => { reject(new Error('port forward stream aborted')) }, { once: true })
        })
        while (true) {
          const next = await Promise.race([host.take(), aborted])
          if (next.done) return
          yield next.value
        }
      })(this)
    },
    close: async () => { this.closed += 1 },
  }

  private take(): Promise<IteratorResult<unknown>> {
    const frame = this.ready.shift()
    if (frame !== undefined) return Promise.resolve({ done: false, value: frame })
    return new Promise((resolve) => { this.waiting.push(resolve) })
  }

  /** Send one frame to the client. */
  push(frame: unknown): void {
    const waiting = this.waiting.shift()
    if (waiting === undefined) this.ready.push(frame)
    else waiting({ done: false, value: frame })
  }
}

const base64 = (text: string): string => Buffer.from(text).toString('base64')
const client = new DeviceClient('https://host.example/')

async function opened(host: FakeHost, controller = new AbortController()): Promise<{ port: number; close: () => Promise<void> }> {
  const forward = await forwardHostPort(client, 8080, { listen: 0, streams: () => host.opener, signal: controller.signal })
  return { port: forward.port, close: () => forward.close() }
}

/** Resolve with everything the socket delivers before it ends. */
function read(socket: Socket): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    socket.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    socket.on('end', () => { resolve(Buffer.concat(chunks)) })
    socket.on('close', () => { resolve(Buffer.concat(chunks)) })
  })
}

function closed(socket: Socket): Promise<void> {
  return new Promise((resolve) => { socket.on('close', () => { resolve() }) })
}

it('relays bytes both ways until each side ends its half', async () => {
  const host = new FakeHost()
  const forward = await opened(host)
  const socket = connect(forward.port)
  // The generated descriptor names its one parameter `request`; the Gateway rejects a bare `port`.
  await vi.waitFor(() => { expect(host.opened).toEqual([{ request: { port: 8080 } }]) })
  host.push({ type: 'connected', port: 8080 })
  const received = read(socket)
  socket.write('hello')
  socket.end()
  await vi.waitFor(() => { expect(host.sent).toEqual([{ type: 'data', data: base64('hello') }, { type: 'end' }]) })
  host.push({ type: 'data', data: base64('world') })
  host.push({ type: 'end' })
  expect((await received).toString()).toBe('world')
  await forward.close()
  expect(host.closed).toBe(1)
})

it('delivers output larger than the socket buffer once the local side drains', async () => {
  const host = new FakeHost()
  const forward = await opened(host)
  const socket = connect(forward.port)
  await vi.waitFor(() => { expect(host.opened).toHaveLength(1) })
  host.push({ type: 'connected', port: 8080 })
  const payload = Buffer.alloc(4 * 1024 * 1024, 1)
  const received = read(socket)
  host.push({ type: 'data', data: payload.toString('base64') })
  host.push({ type: 'end' })
  expect((await received).length).toBe(payload.length)
  await forward.close()
})

it('closes the connection when the Host reports a failure', async () => {
  const host = new FakeHost()
  const forward = await opened(host)
  const socket = connect(forward.port)
  const ended = closed(socket)
  await vi.waitFor(() => { expect(host.opened).toHaveLength(1) })
  host.push({ type: 'failed', code: 'refused', message: 'connection refused' })
  await ended
  await forward.close()
  expect(host.closed).toBe(1)
})

it('closes the connection on a frame outside the contract', async () => {
  const host = new FakeHost()
  const forward = await opened(host)
  const socket = connect(forward.port)
  const ended = closed(socket)
  await vi.waitFor(() => { expect(host.opened).toHaveLength(1) })
  host.push({ type: 'bogus' })
  host.push({ type: 'data' })
  await ended
  await forward.close()
})

it('refuses a loopback port another listener holds', async () => {
  const host = new FakeHost()
  const first = await opened(host)
  await expect(forwardHostPort(client, 8080, { listen: first.port, streams: () => host.opener, signal: new AbortController().signal }))
    .rejects.toMatchObject({ code: 'EADDRINUSE' })
  await first.close()
})

it('stops listening and ends its tunnels when aborted', async () => {
  const host = new FakeHost()
  const controller = new AbortController()
  const forward = await opened(host, controller)
  const socket = connect(forward.port)
  const ended = closed(socket)
  await vi.waitFor(() => { expect(host.opened).toHaveLength(1) })
  controller.abort()
  await ended
  await forward.close()
  expect(host.closed).toBe(1)
  await expect(new Promise<void>((resolve, reject) => {
    const retry = connect(forward.port)
    retry.on('connect', () => { retry.destroy(); resolve() })
    retry.on('error', reject)
  })).rejects.toMatchObject({ code: 'ECONNREFUSED' })
})

it('resolves the Host of the connection each time a socket opens, so a route switch reaches new tunnels', () => {
  const opened: string[] = []
  type Host = Pick<DeviceClient, 'openSocket'>
  const route = (name: string): Host => ({
    openSocket: <Socket>(path: string, _connect: (url: URL, cookie: string) => Socket): Socket => {
      opened.push(`${name}:${path}`)
      return {} as Socket
    },
  })
  const connection: { host: Host } = { host: route('first') }
  const client = currentHost(connection)
  client.openSocket('api/remote.mux', () => ({} as never))
  connection.host = route('second')
  client.openSocket('api/remote.mux', () => ({} as never))
  expect(opened).toEqual(['first:api/remote.mux', 'second:api/remote.mux'])
})

it('keeps each connection on its own stream', async () => {
  const host = new FakeHost()
  const forward = await opened(host)
  const first = connect(forward.port)
  const second = connect(forward.port)
  await vi.waitFor(() => { expect(host.opened).toHaveLength(2) })
  first.destroy()
  second.destroy()
  await forward.close()
  expect(host.closed).toBe(2)
})
