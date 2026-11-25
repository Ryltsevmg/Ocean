/**
 * The `portForward` namespace: one stream per loopback TCP connection, bytes in
 * both directions, the frames that end a stream, backpressure on both links,
 * cancellation, and the device policy the Gateway's `remote-device` scope leaves in place.
 */

import { EventEmitter, once } from 'node:events'
import { createConnection, createServer, Socket, type AddressInfo, type Server } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import RemoteAccessService from '@ocean/ocean-api-remote-access'
import TypertGatewayService from '@ocean/ocean-api-gateway'
import { Peer, type DeviceScope } from '@ocean/ocean-client-connection'
import type { PeerScope, Principal, PrincipalMap } from '@ocean/ocean-typert-protocol'
import TypertRegistry from '@ocean/ocean-typert-registry'
import PortForwardController from '../src/index.ts'
import type { PortForwardFrame, PortForwardInput } from '../src/types.ts'

// One spec replaces the socket factory to deliver reads the kernel would split, and a connect error loopback never raises.
vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>()
  return { ...actual, createConnection: vi.fn(actual.createConnection) }
})

const roots: Context[] = []
const servers: Server[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve) => { server.close(() =>{  resolve() }) })))
  await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** Mount the Remote stack, then the controller on top of an optional Connection double holding device scopes. */
async function mounted(live: Readonly<Record<string, readonly DeviceScope[]>> = {}): Promise<Context> {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(RemoteAccessService)
  await ctx.plugin(TypertGatewayService)
  if (Object.keys(live).length > 0) {
    ctx.provide('connection', {
      rpc: { intercept: () => () => Promise.resolve() },
      deviceScopes: (deviceId: string) => live[deviceId],
    } as never)
  }
  await ctx.plugin(PortForwardController)
  return ctx
}

/** An in-process Peer of one principal, disposed with the test tree. */
function peerFor(ctx: Context, principal: Principal): PeerScope {
  return new Peer(ctx.root, { principal })
}

/** Open one `portForward` stream as one Peer; `args` is the request the generated Client method sends. */
function open(ctx: Context, port: number, uplink: AsyncIterable<unknown> = ended(), signal = new AbortController().signal, principal: Principal = { kind: 'owner' }): Promise<AsyncIterable<unknown>> {
  return ctx.typertGateway.stream({ peer: peerFor(ctx, principal), namespace: 'portForward', method: 'open', args: { request: { port } }, uplink, signal })
}

/** An uplink that is already closed, as a Client that only reads leaves it. */
async function* ended(): AsyncIterable<never> {}

/** The given items as an uplink that closes after them. */
async function* items(values: readonly PortForwardInput[]): AsyncIterable<PortForwardInput> {
  yield* values
}

/** An uplink the Client keeps open without sending anything, as a Client that only reads from the port leaves it. */
function silent(): AsyncIterable<never> {
  return { [Symbol.asyncIterator]: () => ({ next: () => new Promise<IteratorResult<never>>(() => undefined) }) }
}

/** An uplink of `count` `data` items computed as the stream pulls them, counting each pull. */
async function* lazyItems(count: number, itemAt: (index: number) => PortForwardInput, onPull: () => void): AsyncIterable<PortForwardInput> {
  for (let index = 0; index < count; index++) {
    onPull()
    yield itemAt(index)
  }
}

/** Every frame of one stream, in order. */
async function collect(source: AsyncIterable<unknown> | AsyncIterator<unknown>): Promise<PortForwardFrame[]> {
  const iterable: AsyncIterable<unknown> = Symbol.asyncIterator in source ? source : { [Symbol.asyncIterator]: () => source }
  const frames: PortForwardFrame[] = []
  for await (const frame of iterable) frames.push(frame as PortForwardFrame)
  return frames
}

/** Decode the `data` frames of one stream back into the bytes the port sent. */
function bytesOf(frames: readonly PortForwardFrame[]): Buffer {
  return Buffer.concat(frames.flatMap(frame => frame.type === 'data' ? [Buffer.from(frame.data, 'base64')] : []))
}

/** A TCP server on an ephemeral loopback port; resolves once it listens, with that port. */
async function listening(handler: (socket: Socket) => void): Promise<number> {
  const server = createServer((socket) => {
    // A Client that disconnects abruptly resets this side; each spec observes what it needs explicitly.
    socket.on('error', () => undefined)
    handler(socket)
  })
  servers.push(server)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return (server.address() as AddressInfo).port
}

/** Write a payload in 16 KiB pieces, honoring the socket's backpressure, then close. */
async function sendAll(socket: Socket, payload: Buffer): Promise<void> {
  for (let offset = 0; offset < payload.length; offset += 16 * 1024) {
    if (!socket.write(payload.subarray(offset, offset + 16 * 1024))) await once(socket, 'drain')
  }
  socket.end()
}

/**
 * The socket surface the relay uses, for outcomes a real loopback socket cannot
 * deliver on demand: one connect error of a chosen code, or one read larger than a frame.
 */
class FakeSocket extends EventEmitter {
  destroyed = false

  constructor(private readonly output: readonly Buffer[], private readonly failure?: unknown) {
    super()
  }

  write(): boolean { return true }

  end(): void {}

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.emit('close')
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<Buffer> {
    yield* this.output
    if (this.failure !== undefined) throw this.failure
  }
}

/** Make the next `createConnection` return `fake` instead of a real socket. */
function nextConnection(fake: FakeSocket): void {
  vi.mocked(createConnection).mockImplementationOnce((() => fake) as never)
}

const PHONE = '22222222-2222-4222-8222-222222222222'

describe('portForward namespace', () => {
  it.each([0, 65536, 8080.5])('refuses port %s as invalid before touching the network', async (port) => {
    const ctx = await mounted()

    await expect(open(ctx, port)).rejects.toMatchObject({ code: 'port-forward/invalid-port', details: { port } })
  })

  it('rejects a request that names the port without the parameter the descriptor declares', async () => {
    const ctx = await mounted()

    await expect(ctx.typertGateway.stream({
      peer: peerFor(ctx, { kind: 'owner' }), namespace: 'portForward', method: 'open',
      args: { port: 4000 }, uplink: ended(), signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'gateway/arguments-invalid' })
  })

  it('relays bytes both ways, half-closes on a Client end item, and ends when the port closes', async () => {
    const hello = Buffer.from('hello over the forwarded port')
    const received = Promise.withResolvers<Buffer>()
    const port = await listening((socket) => {
      const chunks: Buffer[] = []
      socket.on('data', (chunk: Buffer) => { chunks.push(chunk); socket.write(chunk) })
      socket.on('end', () => { received.resolve(Buffer.concat(chunks)); socket.end() })
    })
    const ctx = await mounted()

    const frames = await collect(await open(ctx, port, items([{ type: 'data', data: hello.toString('base64') }, { type: 'end' }])))

    expect(frames).toEqual([
      { type: 'connected', port },
      { type: 'data', data: hello.toString('base64') },
      { type: 'end' },
    ])
    // The port saw every Client byte and then EOF, which is what `socket.end()` sends.
    await expect(received.promise).resolves.toEqual(hello)
  })

  it('treats a Client that ends its uplink without an end item as a half-close too', async () => {
    const received = Promise.withResolvers<Buffer>()
    const port = await listening((socket) => {
      const chunks: Buffer[] = []
      socket.on('data', (chunk: Buffer) => { chunks.push(chunk); socket.write(chunk) })
      socket.on('end', () => { received.resolve(Buffer.concat(chunks)); socket.end() })
    })
    const ctx = await mounted()
    const ping = Buffer.from('ping')

    const frames = await collect(await open(ctx, port, items([{ type: 'data', data: ping.toString('base64') }])))

    expect(frames).toEqual([{ type: 'connected', port }, { type: 'data', data: ping.toString('base64') }, { type: 'end' }])
    await expect(received.promise).resolves.toEqual(ping)
  })

  it('splits one socket read larger than a frame into frames of at most 64 KiB', async () => {
    const payload = Buffer.alloc(150 * 1024, 7)
    const fake = new FakeSocket([payload])
    nextConnection(fake)
    const ctx = await mounted()
    const iterator = (await open(ctx, 4000))[Symbol.asyncIterator]()

    const first = iterator.next()
    fake.emit('connect')
    expect(await first).toMatchObject({ done: false, value: { type: 'connected', port: 4000 } })
    const frames = await collect(iterator)

    expect(frames.map(frame => frame.type === 'data' ? Buffer.from(frame.data, 'base64').length : frame.type)).toEqual([64 * 1024, 64 * 1024, 22 * 1024, 'end'])
    expect(bytesOf(frames)).toEqual(payload)
    expect(fake.destroyed).toBe(true)
  })

  it('reports a port nobody listens on as refused, and ends the stream there', async () => {
    const port = await listening(() => undefined)
    await new Promise<void>((resolve) => { servers.pop()!.close(() =>{  resolve() }) })
    const ctx = await mounted()

    const frames = await collect(await open(ctx, port))

    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ type: 'failed', code: 'refused' })
    const first = frames[0]
    expect(first?.type === 'failed' ? first.message : '').toContain('ECONNREFUSED')
  })

  it('stops writing Client bytes once a refused connection destroys the socket, and still ends the stream', async () => {
    const port = await listening(() => undefined)
    await new Promise<void>((resolve) => { servers.pop()!.close(() =>{  resolve() }) })
    const ctx = await mounted()
    const data = Buffer.alloc(1024 * 1024).toString('base64')

    const frames = await collect(await open(ctx, port, items([{ type: 'data', data }, { type: 'data', data }, { type: 'end' }])))

    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ type: 'failed', code: 'refused' })
  })

  it('reports any other connect error as unreachable', async () => {
    const fake = new FakeSocket([])
    nextConnection(fake)
    const ctx = await mounted()
    const iterator = (await open(ctx, 4000))[Symbol.asyncIterator]()

    const first = iterator.next()
    fake.emit('error', Object.assign(new Error('connect EHOSTUNREACH'), { code: 'EHOSTUNREACH' }))
    fake.emit('close')

    expect(await first).toEqual({ done: false, value: { type: 'failed', code: 'unreachable', message: 'connect EHOSTUNREACH' } })
    expect(await collect(iterator)).toEqual([])
    expect(fake.destroyed).toBe(true)
  })

  it('reports a connection that breaks after it was established as unreachable, not as an end', async () => {
    const port = await listening((socket) => { socket.write('hi', () => socket.resetAndDestroy()) })
    const ctx = await mounted()

    const frames = await collect(await open(ctx, port))

    expect(frames[0]).toEqual({ type: 'connected', port })
    expect(frames.at(-1)).toMatchObject({ type: 'failed', code: 'unreachable' })
    expect(frames.some(frame => frame.type === 'end')).toBe(false)
  })

  it('delivers every byte to a Client that reads slowly while the port writes faster than it is read', async () => {
    const payload = Buffer.alloc(2 * 1024 * 1024)
    for (let offset = 0; offset < payload.length; offset++) payload[offset] = offset % 251
    let held: Socket | undefined
    const write = vi.spyOn(Socket.prototype, 'write')
    const port = await listening((socket) => {
      held = socket
      void sendAll(socket, payload)
    })
    const ctx = await mounted()

    const frames: PortForwardFrame[] = []
    for await (const frame of await open(ctx, port, silent())) {
      frames.push(frame as PortForwardFrame)
      await delay(1)
    }

    expect(frames[0]).toEqual({ type: 'connected', port })
    expect(frames.at(-1)).toEqual({ type: 'end' })
    expect(bytesOf(frames).equals(payload)).toBe(true)
    // The port's writes stalled: the relay stopped reading the socket while the Client paused.
    expect(write.mock.results.some((result, index) => write.mock.contexts[index] === held && result.value === false)).toBe(true)
  })

  it('waits for the socket to drain before pulling the next uplink item while the port does not read', async () => {
    const total = 32 * 1024 * 1024
    const piece = 1024 * 1024
    const payload = Buffer.alloc(total)
    for (let offset = 0; offset < total; offset++) payload[offset] = Math.floor(offset / piece) % 251
    const received = Promise.withResolvers<Buffer>()
    const accepted = Promise.withResolvers<Socket>()
    const port = await listening((socket) => {
      const chunks: Buffer[] = []
      socket.on('data', (chunk: Buffer) => chunks.push(chunk))
      socket.on('end', () => { received.resolve(Buffer.concat(chunks)); socket.end() })
      socket.pause()
      accepted.resolve(socket)
    })
    const write = vi.spyOn(Socket.prototype, 'write')
    const ctx = await mounted()
    let pulled = 0
    const source = await open(ctx, port, lazyItems(total / piece, index => ({ type: 'data', data: payload.subarray(index * piece, (index + 1) * piece).toString('base64') }), () => { pulled += 1 }))
    const iterator = source[Symbol.asyncIterator]()
    expect(await iterator.next()).toMatchObject({ done: false, value: { type: 'connected', port } })

    // The port reads nothing, so the full socket stalls the pump on drain; no further item is pulled meanwhile.
    await vi.waitFor(() => { expect(write.mock.results.some(result => result.value === false)).toBe(true) })
    await delay(100)
    const stalled = pulled
    expect(stalled).toBeLessThan(total / piece)

    const frames = collect(iterator)
    const portSocket = await accepted.promise
    portSocket.resume()

    const portRead = await received.promise
    expect(portRead.equals(payload)).toBe(true)
    expect((await frames).at(-1)).toEqual({ type: 'end' })
    expect(pulled).toBe(total / piece)
  })

  it('keeps relaying when the Client uplink is rejected by the carrier', async () => {
    const ok = Buffer.from('ok')
    const port = await listening((socket) => { socket.end(ok) })
    const ctx = await mounted()
    const broken: AsyncIterable<never> = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error('uplink closed by the Gateway')),
        return: () => Promise.resolve({ done: true, value: undefined }),
      }),
    }

    const frames = await collect(await open(ctx, port, broken))

    expect(frames.at(-1)).toEqual({ type: 'end' })
    expect(bytesOf(frames).toString()).toBe('ok')
  })

  it('reports a failure that is not an Error by its string form', async () => {
    const fake = new FakeSocket([], 'socket broke without an Error')
    nextConnection(fake)
    const ctx = await mounted()
    const iterator = (await open(ctx, 4000))[Symbol.asyncIterator]()

    const first = iterator.next()
    fake.emit('connect')
    expect(await first).toMatchObject({ done: false, value: { type: 'connected', port: 4000 } })

    expect(await collect(iterator)).toEqual([{ type: 'failed', code: 'unreachable', message: 'socket broke without an Error' }])
  })

  it('destroys the socket when the stream is cancelled after it connected', async () => {
    const portClosed = Promise.withResolvers<undefined>()
    const port = await listening((socket) => {
      socket.on('close', () => { portClosed.resolve(undefined) })
      socket.write('ready')
    })
    const ctx = await mounted()
    const abort = new AbortController()
    const iterator = (await open(ctx, port, ended(), abort.signal))[Symbol.asyncIterator]()
    expect(await iterator.next()).toMatchObject({ done: false, value: { type: 'connected', port } })

    abort.abort(new Error('Client went away'))

    await expect(iterator.next()).rejects.toMatchObject({ code: 'gateway/cancelled' })
    await portClosed.promise
  })

  it('destroys the socket when the stream is cancelled while it is still connecting', async () => {
    const port = await listening(() => undefined)
    const ctx = await mounted()
    const abort = new AbortController()
    const iterator = (await open(ctx, port, ended(), abort.signal))[Symbol.asyncIterator]()
    const first = iterator.next()
    abort.abort(new Error('Client went away'))

    await expect(first).rejects.toMatchObject({ code: 'gateway/cancelled' })
    expect(await collect(iterator)).toEqual([])
  })

  it('refuses an already-cancelled stream before creating a socket', async () => {
    const ctx = await mounted()

    await expect(open(ctx, 4000, ended(), AbortSignal.abort())).rejects.toMatchObject({ code: 'gateway/cancelled' })
  })

  it('requires a Remote invocation, so an in-process caller cannot open a stream', async () => {
    const ctx = await mounted()
    const controller = ctx.get('portForwardController') as PortForwardController

    expect(() => controller.open({ port: 4000 }, new AbortController().signal)).toThrow('Port forwarding requires a Remote invocation')
  })

  it('admits a device holding terminal:operate and denies one without it', async () => {
    const ok = Buffer.from('ok')
    const port = await listening(socket => socket.end(ok))
    const ctx = await mounted({ [PHONE]: ['terminal:operate'], other: ['sessions:read'] })
    const device = (deviceId: string): PrincipalMap['remote-device'] => ({ kind: 'remote-device', deviceId: deviceId as PrincipalMap['remote-device']['deviceId'] })

    const frames = await collect(await open(ctx, port, ended(), undefined, device(PHONE)))
    expect(frames).toEqual([{ type: 'connected', port }, { type: 'data', data: ok.toString('base64') }, { type: 'end' }])
    await expect(open(ctx, port, ended(), undefined, device('other'))).rejects.toMatchObject({
      code: 'remote-access/denied', details: { action: 'portForward/open', reason: 'no-allow' },
    })
  })

  it('stays unactivated while the composition mounts no Typert registry', async () => {
    const ctx = new Context()
    roots.push(ctx)

    await ctx.plugin(PortForwardController)

    expect(ctx.get('portForwardController')).toBeUndefined()
  })
})
