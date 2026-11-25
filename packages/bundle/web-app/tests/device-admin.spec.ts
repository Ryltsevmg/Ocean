/**
 * Device administration commands over their real transports: a local
 * administrator HTTP socket and the local credential store, booted through
 * the real Loader by the shared device-launcher harness.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import { DeviceBootstrap } from '@ocean/ocean-client-connection'
import { DeviceTokens } from '@ocean/ocean-client-connection/src/device-tokens.ts'
import { internals, provideCmdline } from '@ocean/ocean-cmdline'
import LocalCredentials from '@ocean/ocean-credentials-local'
import { pairingLink, runDeviceAdmin } from '../src/device-admin-client.ts'
import { qrTerminal } from '../src/pairing-qr.ts'
import { bootDeviceProfile, type DeviceBoot } from './device-launcher.ts'

let boot: DeviceBoot | undefined
let socketDir: string | undefined
let server: Server | undefined
let credentialDir: string | undefined
const received: { operation: unknown; headers: IncomingMessage['headers'] }[] = []
const logs: string[] = []
const errors: string[] = []

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation((message: unknown) => { logs.push(String(message)) })
  vi.spyOn(console, 'error').mockImplementation((message: unknown) => { errors.push(String(message)) })
})

afterEach(async () => {
  await boot?.dispose()
  boot = undefined
  if (server !== undefined) {
    server.closeAllConnections()
    await new Promise<void>((resolve) => { server!.close(() => { resolve() }) })
    server = undefined
  }
  if (socketDir !== undefined) await rm(socketDir, { recursive: true, force: true })
  socketDir = undefined
  if (credentialDir !== undefined) await rm(credentialDir, { recursive: true, force: true })
  credentialDir = undefined
  received.length = 0
  logs.length = 0
  errors.length = 0
  vi.restoreAllMocks()
  internals.stdout = process.stdout
  internals.stderr = process.stderr
})

/** Send one JSON reply with the given status. */
function replyJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/**
 * Own one administrator socket whose replies the test scripts.
 * @param reply - answers each decoded operation.
 * @returns the absolute socket path.
 */
async function listenAdmin(reply: (operation: unknown, res: ServerResponse) => void): Promise<string> {
  socketDir = await mkdtemp(join(tmpdir(), 'ocean-device-admin-'))
  const path = join(socketDir, 'admin.sock')
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => {
      const operation: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      received.push({ operation, headers: req.headers })
      reply(operation, res)
    })
  })
  await new Promise<void>((resolve) => { server!.listen(path, resolve) })
  return path
}

/**
 * Mount a real local credential store and its bootstrap service on the tree root.
 * @param ctx - the boot's root context.
 * @returns the credential provider fiber, whose disposal makes the store unavailable.
 */
async function provideBootstrap(ctx: Context): Promise<Fiber> {
  credentialDir = await mkdtemp(join(tmpdir(), 'ocean-device-credentials-'))
  const fiber = await ctx.plugin(LocalCredentials, { path: join(credentialDir, '.credentials.yaml'), watch: false })
  new DeviceBootstrap(ctx)
  return fiber
}

const SOCKET_FAILURE = 'ocean remote-device: command failed. Verify the Host and socket path, then inspect device state before retrying.'
const BOOTSTRAP_FAILURE = 'ocean remote-device: command failed. Verify access to the Host credential store, then list devices before retrying.'
const UNKNOWN_OUTCOME = 'ocean remote-device: operation outcome is unknown. Inspect device state before retrying.'

describe('remote-device over the administrator socket', () => {
  it.each([
    { args: ['list'], operation: { action: 'list' }, result: [{ id: 'd1', label: 'laptop', revoked: false }] },
    { args: ['create', 'laptop'], operation: { action: 'create', label: 'laptop' }, result: { id: 'd1', token: 'device-token' } },
    { args: ['rotate', 'd1'], operation: { action: 'rotate', id: 'd1' }, result: 'replacement-token' },
    { args: ['revoke', 'd1'], operation: { action: 'revoke', id: 'd1' }, result: true },
  ])('runs $args and prints the Host result', async ({ args, operation, result }) => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, ...args])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(received).toHaveLength(1)
    expect(received[0]!.operation).toEqual(operation)
    expect(received[0]!.headers['content-type']).toBe('application/json')
    expect(received[0]!.headers['content-length']).toBe(String(Buffer.byteLength(JSON.stringify(operation))))
    expect(logs).toEqual([JSON.stringify(result)])
    expect(errors).toEqual([])
  })

  it.each([
    { description: 'a committed change with failed cleanup',
      body: { error: { durableOutcome: 'committed', liveCleanup: 'failed' } },
      message: 'ocean remote-device: the access change was saved, but live connection cleanup failed. Inspect the Host before retrying.' },
    { description: 'a committed change with successful cleanup',
      body: { error: { durableOutcome: 'committed', liveCleanup: 'ok' } }, message: UNKNOWN_OUTCOME },
    { description: 'an uncommitted change with failed cleanup',
      body: { error: { durableOutcome: 'pending', liveCleanup: 'failed' } }, message: UNKNOWN_OUTCOME },
    { description: 'an error without outcome fields', body: { error: {} }, message: UNKNOWN_OUTCOME },
    { description: 'a null error', body: { error: null }, message: UNKNOWN_OUTCOME },
    { description: 'a payload without an error', body: {}, message: UNKNOWN_OUTCOME },
    { description: 'a null payload', body: null, message: UNKNOWN_OUTCOME },
  ])('reports $description', async ({ body, message }) => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 500, body) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'revoke', 'd1'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(logs).toEqual([])
    expect(errors).toEqual([message])
  })

  it.each([
    { raw: 'not json', description: 'invalid JSON' },
    { raw: '5', description: 'a non-object payload' },
    { raw: 'null', description: 'a null payload' },
    { raw: '{}', description: 'a payload without a result' },
    { raw: '{"result":null}', description: 'an absent device' },
    { raw: '{"result":false}', description: 'an inactive device' },
  ])('fails the command on $description', async ({ raw }) => {
    const path = await listenAdmin((_operation, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(raw)
    })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(logs).toEqual([])
    expect(errors).toEqual([SOCKET_FAILURE])
  })

  it('prints a pairing link that keeps the grant in the fragment', async () => {
    const grant = `${'a'.repeat(8)}-aaaa-4aaa-8aaa-${'a'.repeat(12)}.${'B'.repeat(43)}`
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: { grant, expiresAt: 1_700_000_000_000 } }) })
    boot = await bootDeviceProfile('remote-device', [
      '--socket', path, 'pair', 'Phone', '--url', 'https://ocean.example/mount', '--ttl', '120',
    ])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(received[0]!.operation).toEqual({ action: 'pair', label: 'Phone', ttlSeconds: 120 })
    const printed = JSON.parse(logs[0]!) as { link: string; web: string; expiresAt: string }
    expect(printed.expiresAt).toBe('2023-11-14T22:13:20.000Z')
    expect(printed.web).toBe(`https://ocean.example/mount/#pair=${grant}`)
    expect(errors).toEqual([])
    const link = new URL(printed.link)
    expect(link.protocol).toBe('ocean:')
    expect(link.hostname).toBe('pair')
    expect(link.searchParams.get('host')).toBe('https://ocean.example/mount')
    expect(link.searchParams.get('label')).toBe('Phone')
    expect(link.hash).toBe(`#${grant}`)
    expect(link.search).not.toContain(grant)
    expect(printed.link).toBe(pairingLink('https://ocean.example/mount', 'Phone', grant))
  })

  it('uses the address the Host advertises when --url is absent', async () => {
    const grant = `${'a'.repeat(8)}-aaaa-4aaa-8aaa-${'a'.repeat(12)}.${'B'.repeat(43)}`
    const path = await listenAdmin((_operation, res) => {
      replyJson(res, 200, { result: { grant, expiresAt: 1_700_000_000_000, address: 'https://bigpc.tail71ee4f.ts.net/' } })
    })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'pair', 'Phone'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const printed = JSON.parse(logs[0]!) as { link: string; web: string }
    expect(new URL(printed.link).searchParams.get('host')).toBe('https://bigpc.tail71ee4f.ts.net/')
    expect(printed.web).toBe(`https://bigpc.tail71ee4f.ts.net/#pair=${grant}`)
  })

  it('prints a QR code of the browser link to standard error with --qr', async () => {
    const grant = `${'a'.repeat(8)}-aaaa-4aaa-8aaa-${'a'.repeat(12)}.${'B'.repeat(43)}`
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: { grant, expiresAt: 1_700_000_000_000 } }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'pair', 'Phone', '--url', 'https://ocean.example', '--qr'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toHaveLength(1)
    expect((JSON.parse(logs[0]!) as { web: string }).web).toBe(`https://ocean.example/#pair=${grant}`)
    expect(errors).toEqual([qrTerminal(`https://ocean.example/#pair=${grant}`)])
  })

  it('prefers an explicit --url over the advertised address', async () => {
    const path = await listenAdmin((_operation, res) => {
      replyJson(res, 200, { result: { grant: 'g', expiresAt: 1, address: 'https://advertised.example/' } })
    })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'pair', 'Phone', '--url', 'https://chosen.example/'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(new URL((JSON.parse(logs[0]!) as { link: string }).link).searchParams.get('host')).toBe('https://chosen.example/')
  })

  it('asks for --url when the Host advertises no address', async () => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: { grant: 'g', expiresAt: 1 } }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'pair', 'Phone'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(logs).toEqual([])
    expect(errors).toEqual(['ocean remote-device: pass --url: this Host does not advertise an HTTPS address'])
  })

  it.each([
    { args: ['create', 'laptop', '--scope', 'terminal:operate', '--scope', 'sessions:read', '--scope', 'sessions:read'], operation: { action: 'create', label: 'laptop', scopes: ['sessions:read', 'terminal:operate'] } },
    { args: ['pair', 'phone', '--url', 'https://ocean.example/', '--scope', 'files:read'], operation: { action: 'pair', label: 'phone', scopes: ['files:read'] } },
  ])('sends the named scopes, once each in catalog order, for $args', async ({ args, operation }) => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: { id: 'd1', token: 't', grant: 'g', expiresAt: 1 } }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, ...args])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(received[0]!.operation).toEqual(operation)
  })

  it.each(['create', 'pair'])('rejects an unknown scope for %s before contacting the Host', async (command) => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: {} }) })
    const url = command === 'pair' ? ['--url', 'https://ocean.example/'] : []
    boot = await bootDeviceProfile('remote-device', ['--socket', path, command, 'phone', ...url, '--scope', 'admin'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(received).toEqual([])
    expect(boot.observed.err).toContain('unknown device scope "admin"')
  })

  it('sends no scopes when none are named, so the device holds every right', async () => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: { id: 'd1', token: 't' } }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'create', 'laptop'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(received[0]!.operation).toEqual({ action: 'create', label: 'laptop' })
  })

  it('sends no lifetime when the pairing command names none', async () => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: { grant: 'g', expiresAt: 1 } }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'pair', 'Phone', '--url', 'https://ocean.example/'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(received[0]!.operation).toEqual({ action: 'pair', label: 'Phone' })
  })

  it.each([
    { description: 'an unparsable address', args: ['--url', 'not a url'], message: '--url must be a valid HTTPS address' },
    { description: 'an HTTP address', args: ['--url', 'http://ocean.example/'], message: '--url must be an HTTPS address without credentials, a query, or a fragment' },
    { description: 'an address with credentials', args: ['--url', 'https://user:secret@ocean.example/'], message: '--url must be an HTTPS address' },
    { description: 'a lifetime below the minimum', args: ['--url', 'https://ocean.example/', '--ttl', '10'], message: 'expected an integer from 30 to 3600' },
    { description: 'a non-numeric lifetime', args: ['--url', 'https://ocean.example/', '--ttl', 'soon'], message: 'expected an integer from 30 to 3600' },
  ])('rejects $description before contacting the Host', async ({ args, message }) => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: {} }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'pair', 'Phone', ...args])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(received).toEqual([])
    expect(boot.observed.err).toContain(message)
  })

  it('fails the command when the reply exceeds its size limit', async () => {
    const path = await listenAdmin((_operation, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(Buffer.alloc(1024 * 1024 + 1, 0x61))
    })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([SOCKET_FAILURE])
  })

  it('fails the command when the socket is absent', async () => {
    socketDir = await mkdtemp(join(tmpdir(), 'ocean-device-admin-'))
    boot = await bootDeviceProfile('remote-device', ['--socket', join(socketDir, 'absent.sock'), 'list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([SOCKET_FAILURE])
  })

  it('accepts a valid timeout and fails the command when the Host stays silent', async () => {
    const path = await listenAdmin(() => { /* hold the reply past the timeout */ })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, '--timeout', '100', 'list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(boot.observed.err).toBe('')
    expect(errors).toEqual([SOCKET_FAILURE])
  })

  it('runs nothing before startup commits and detaches on disposal', async () => {
    const path = await listenAdmin((_operation, res) => { replyJson(res, 200, { result: [] }) })
    boot = await bootDeviceProfile('remote-device', ['--socket', path, 'list'], { holdReady: true })
    expect(boot.exits).toEqual([])
    expect(received).toEqual([])
    const held = boot
    await boot.dispose()
    boot = undefined
    held.commit()
    expect(received).toEqual([])
    expect(held.exits).toEqual([])
  })

  it('requires the profile launcher', () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    provideCmdline(ctx, { args: ['--socket', '/local/admin.sock', 'list'], exit: () => {} })
    expect(() => { runDeviceAdmin(ctx) }).toThrow('device administration requires the profile launcher')
  })
})

describe('remote-device local bootstrap', () => {
  it('creates a device and prints its token once', async () => {
    boot = await bootDeviceProfile('remote-device', ['--bootstrap', 'create', 'laptop'], { provide: provideBootstrap })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(errors).toEqual([])
    expect(logs).toHaveLength(1)
    const issued = JSON.parse(logs[0]!) as { id: string; token: string }
    expect(issued).toMatchObject({ id: expect.any(String) as string, token: expect.any(String) as string })
    expect(issued.token).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/u)
  })

  it('lists the devices in the credential store', async () => {
    let issued: { id: string } | undefined
    boot = await bootDeviceProfile('remote-device', ['--bootstrap', 'list'], {
      provide: async (ctx) => {
        await provideBootstrap(ctx)
        issued = await new DeviceTokens(ctx.credentials).issue('laptop')
      },
    })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual([JSON.stringify([{ id: issued!.id, label: 'laptop', revoked: false }])])
    expect(errors).toEqual([])
  })

  it('lists an empty credential store', async () => {
    boot = await bootDeviceProfile('remote-device', ['--bootstrap', 'list'], { provide: provideBootstrap })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual(['[]'])
  })

  it('refuses pairing in bootstrap mode because a grant needs a running Host', async () => {
    boot = await bootDeviceProfile('remote-device', ['--bootstrap', 'pair', 'Phone', '--url', 'https://ocean.example/'], {
      provide: provideBootstrap,
    })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(boot.observed.err).toContain('--bootstrap supports create and list')
  })

  it.each(['create', 'list'] as const)('fails %s when the bootstrap operation rejects', async (action) => {
    const unavailable = () => Promise.reject(new Error('credential store unavailable'))
    boot = await bootDeviceProfile('remote-device', ['--bootstrap', action, ...(action === 'create' ? ['laptop'] : [])], {
      provide: (ctx) => {
        ctx.provide('deviceBootstrap', { issue: unavailable, list: unavailable } as never)
      },
    })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(logs).toEqual([])
    expect(errors).toEqual([BOOTSTRAP_FAILURE])
  })

  it('requires the profile launcher', () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    provideCmdline(ctx, { args: ['--bootstrap', 'list'], exit: () => {} })
    expect(() => { runDeviceAdmin(ctx) }).toThrow('device administration requires the profile launcher')
  })
})
