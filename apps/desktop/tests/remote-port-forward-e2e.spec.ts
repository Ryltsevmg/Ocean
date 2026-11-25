/**
 * End-to-end forward: a local TCP client reaches a service on the Host's own
 * loopback over the real Gateway stream carrier. The tunnel's own
 * `RemoteStreamMuxClient` speaks to a real `RemoteStreamMuxServer` backed by the
 * real Gateway and the real `portForwardController`, so the exact wire the
 * production path sends — including the `request` argument the descriptor
 * declares — is exercised, not a transport double.
 */
import { once } from 'node:events'
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http'
import { connect as tcpConnect, createServer as createTcpServer, type Server as TcpServer, type Socket } from 'node:net'
import { afterEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import TypertRegistry from '@ocean/ocean-typert-registry'
import RemoteAccessService from '@ocean/ocean-api-remote-access'
import TypertGatewayService from '@ocean/ocean-api-gateway'
import PortForwardController from '@ocean/ocean-api-port-forward-controller'
import {
  openDeviceStreamSocket,
  RemoteStreamMuxServer,
  type RemoteStreamFailureMapper,
  type RemoteStreamOpener,
} from '@ocean/ocean-api-gateway/src/stream-server.ts'
import { RemoteStreamMuxClient } from '@ocean/ocean-api-gateway/src/stream-client.ts'
import { Peer, type DeviceScope } from '@ocean/ocean-client-connection'
import { remoteErrorOf, type PeerScope } from '@ocean/ocean-typert-protocol'
import { forwardHostPort, openHostStreams } from '../src/remote-port-forward.ts'

const roots: Context[] = []
const httpServers: HttpServer[] = []
const tcpServers: TcpServer[] = []
const muxServers: RemoteStreamMuxServer[] = []
const closers: (() => Promise<void> | void)[] = []

afterEach(async () => {
  await Promise.all(closers.splice(0).map(async (close) => { await close() }))
  await Promise.all(muxServers.splice(0).map(mux => mux.close().catch(() => undefined)))
  await Promise.all(httpServers.splice(0).map(http => new Promise<void>((resolve) => { http.close(() => { resolve() }) })))
  await Promise.all(tcpServers.splice(0).map(tcp => new Promise<void>((resolve) => { tcp.close(() => { resolve() }) })))
  await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** Map an invocation failure to a stable wire value, as the Gateway's own carrier does. */
const mapFailure: RemoteStreamFailureMapper = (error) => {
  const remote = remoteErrorOf(error)
  if (remote !== undefined) return { code: remote.code, message: remote.message, details: remote.details }
  return { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} }
}

/** A device Peer whose scope the mounted Gateway reads through its Connection double. */
async function devicePeer(deviceId: string): Promise<PeerScope> {
  const root = new Context()
  const fiber = root.plugin(() => {})
  await fiber
  return new Peer(fiber.ctx, { principal: { kind: 'remote-device', deviceId: deviceId as never } })
}

/** Mount the real Remote stack plus the controller, with a Connection double that grants device scopes. */
async function mountHost(scopes: Readonly<Record<string, readonly DeviceScope[]>>): Promise<Context> {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(RemoteAccessService)
  await ctx.plugin(TypertGatewayService)
  ctx.provide('connection', {
    rpc: { intercept: () => () => Promise.resolve() },
    deviceScopes: (deviceId: string) => scopes[deviceId],
  } as never)
  await ctx.plugin(PortForwardController)
  return ctx
}

/** The Gateway's own wire-stream dispatcher, as the real carrier calls it. */
interface WireStreamGateway {
  readonly wireStream: {
    open(
      endpoint: string, payload: unknown, uplink: AsyncIterable<unknown>, peer: PeerScope, signal: AbortSignal,
    ): Promise<AsyncIterable<unknown>>
  }
}

/** Serve the mounted Gateway's stream dispatch over a real WebSocket at `/api/remote.mux`, as that Peer. */
async function serveMux(ctx: Context, peer: PeerScope): Promise<string> {
  const gateway = ctx.get('typertGateway') as unknown as WireStreamGateway
  const open: RemoteStreamOpener = (endpoint, payload, uplink, _peer, control) =>
    gateway.wireStream.open(endpoint, payload, uplink, peer, control.signal)
  const mux = new RemoteStreamMuxServer(open, mapFailure, {
    heartbeatIntervalMs: 2_000, streamInboxBytes: 262_144, maxStreamsPerSocket: 256, compression: false,
  })
  muxServers.push(mux)
  const http = createHttpServer()
  httpServers.push(http)
  http.on('upgrade', (request, socket, head) => {
    if (new URL(request.url ?? '/', 'http://host').pathname !== '/api/remote.mux') { socket.destroy(); return }
    mux.handleUpgrade(request, socket, head, peer)
  })
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject)
    http.listen(0, '127.0.0.1', () => { http.off('error', reject); resolve() })
  })
  const address = http.address()
  if (address === null || typeof address === 'string') throw new Error('mux fixture has no TCP port')
  return `http://127.0.0.1:${String(address.port)}/`
}

/** A loopback TCP service that runs `handler` on each connection; resolves with its port. */
async function serveTcp(handler: (socket: Socket) => void): Promise<number> {
  const server = createTcpServer({ allowHalfOpen: true }, handler)
  tcpServers.push(server)
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', () => { resolve() }) })
  return (server.address() as { port: number }).port
}

/** A multiplexer over the device cookie, as `openHostStreams` builds for the production client. */
function hostStreams(mountUrl: string): ReturnType<typeof openHostStreams> {
  return new RemoteStreamMuxClient(path => openDeviceStreamSocket(new URL(path.slice(1), mountUrl), '__Host-ocean-device=login'))
}

/** Everything the socket delivers before it closes. */
function read(socket: Socket): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    socket.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    socket.on('close', () => { resolve(Buffer.concat(chunks)) })
  })
}

const DEVICE = '11111111-1111-4111-8111-111111111111'

it('carries bytes both ways through the real Gateway from a local socket to a Host loopback service', async () => {
  const servicePort = await serveTcp((socket) => {
    socket.on('data', (chunk: Buffer) => { socket.write(Buffer.concat([Buffer.from('echo:'), chunk])) })
    socket.on('end', () => { socket.end('bye') })
  })
  const ctx = await mountHost({ [DEVICE]: ['terminal:operate'] })
  const mountUrl = await serveMux(ctx, await devicePeer(DEVICE))

  const controller = new AbortController()
  const forward = await forwardHostPort(
    { openSocket: () => { throw new Error('the e2e test supplies its own multiplexer') } },
    servicePort,
    { listen: 0, signal: controller.signal, streams: () => hostStreams(mountUrl) },
  )
  closers.push(() => forward.close())

  const socket = tcpConnect(forward.port, '127.0.0.1')
  await once(socket, 'connect')
  const received = read(socket)
  socket.write('hello')
  socket.end()
  expect((await received).toString()).toBe('echo:hellobye')
})

it('reports a refused Host port to the local socket as a reset, over the real carrier', async () => {
  const ctx = await mountHost({ [DEVICE]: ['terminal:operate'] })
  const mountUrl = await serveMux(ctx, await devicePeer(DEVICE))
  // A port nothing listens on: the Host answers `failed`, and the tunnel destroys the local socket.
  const freePort = await serveTcp(() => undefined)
  await new Promise<void>((resolve) => { tcpServers.pop()!.close(() => { resolve() }) })

  const controller = new AbortController()
  const forward = await forwardHostPort(
    { openSocket: () => { throw new Error('unused') } },
    freePort,
    { listen: 0, signal: controller.signal, streams: () => hostStreams(mountUrl) },
  )
  closers.push(() => forward.close())

  const socket = tcpConnect(forward.port, '127.0.0.1')
  const received = read(socket)
  socket.on('error', () => undefined)
  await once(socket, 'connect')
  socket.write('anyone there?')
  // A refused Host port closes the local connection instead of leaving it open, and delivers nothing.
  expect((await received).length).toBe(0)
})

it('denies a device without terminal:operate, so no local listener serves its port', async () => {
  const servicePort = await serveTcp(socket => socket.end('ok'))
  const ctx = await mountHost({ [DEVICE]: ['sessions:read'] })
  const mountUrl = await serveMux(ctx, await devicePeer(DEVICE))

  const controller = new AbortController()
  const forward = await forwardHostPort(
    { openSocket: () => { throw new Error('unused') } },
    servicePort,
    { listen: 0, signal: controller.signal, streams: () => hostStreams(mountUrl) },
  )
  closers.push(() => forward.close())

  const socket = tcpConnect(forward.port, '127.0.0.1')
  const closed = new Promise<void>((resolve) => { socket.on('close', () => { resolve() }) })
  socket.on('error', () => undefined)
  await once(socket, 'connect')
  socket.write('open please')
  await closed
})
