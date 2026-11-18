/**
 * Remote connect CLI behavior: token acquisition, unary RPC, uploads, question
 * projections, terminal writes, and reconnecting streams. The Host HTTPS
 * boundary is a scripted fetch and the stream carrier is a test-driven socket;
 * DeviceClient, the stream mux, and the command line stay real, booted through
 * the real Loader by the shared device-launcher harness.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  DEVICE_EPOCH_HEADER, DEVICE_HOST_HEADER, DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION,
} from '@ocean/ocean-client-connection/protocol'
import { internals, provideCmdline } from '@ocean/ocean-cmdline'
import { runDeviceConnect } from '../src/device-connect-client.ts'
import { bootDeviceProfile, type DeviceBoot } from './device-launcher.ts'

const carrier = vi.hoisted(() => ({
  openSocket: undefined as undefined | ((url: URL, cookie: string) => unknown),
  delays: [] as number[],
  holdDelay: false,
}))

vi.mock('@ocean/ocean-api-gateway/device', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ocean/ocean-api-gateway/device')>()
  return {
    ...actual,
    openDeviceStreamSocket: (url: URL, cookie: string): unknown => {
      if (carrier.openSocket === undefined) throw new Error('connect test: socket carrier not installed')
      return carrier.openSocket(url, cookie)
    },
  }
})

vi.mock('node:timers/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:timers/promises')>(),
  setTimeout: (ms: number, _value?: unknown, options?: { signal?: AbortSignal }): Promise<unknown> => {
    carrier.delays.push(ms)
    return new Promise((resolve, reject) => {
      const signal = options?.signal
      // AbortSignal.reason belongs to the aborting caller and may be a non-Error sentinel.
      if (signal?.aborted) { reject(signal.reason); return }
      const onAbort = (): void => { reject(signal!.reason) }
      signal?.addEventListener('abort', onAbort, { once: true })
      if (!carrier.holdDelay) {
        signal?.removeEventListener('abort', onAbort)
        resolve(undefined)
      }
    })
  },
}))

/** In-process socket speaking the Remote stream carrier's event surface. */
class FakeSocket extends EventTarget {
  readyState = 0
  readonly sent: string[] = []
  readonly closedWith: { code?: number; reason?: string }[] = []

  constructor(readonly url: URL, readonly cookie: string) { super() }

  open(): void {
    if (this.readyState !== 0) return
    this.readyState = 1
    this.dispatchEvent(new Event('open'))
  }

  fail(): void {
    this.dispatchEvent(new Event('error'))
  }

  send(data: string): void {
    if (this.readyState !== 1) throw new Error('fixture socket is not open')
    this.sent.push(data)
  }

  close(code?: number, reason?: string): void {
    this.closedWith.push({
      ...(code === undefined ? {} : { code }),
      ...(reason === undefined ? {} : { reason }),
    })
    this.drop()
  }

  drop(): void {
    if (this.readyState === 3) return
    this.readyState = 3
    this.dispatchEvent(new Event('close'))
  }

  receive(value: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) }))
  }
}

interface HostCall {
  url: URL
  method: string
  headers: Headers
  body: unknown
  signal: AbortSignal | undefined
}

type RpcResult =
  | { ok: true; value?: unknown }
  | { ok: false; error: { code: unknown; message?: string; details?: Record<string, unknown> } }

/** Scripted Host at the HTTPS boundary: login, identify, logout, unary RPC, upload. */
class ScriptedHost {
  readonly calls: HostCall[] = []
  epoch = 'epoch-1'
  loginStatus = 204
  identifyStatus = 204
  logoutStatus = 204
  readonly results = new Map<string, RpcResult>()
  loginOverride?: (call: HostCall) => Response | Promise<Response>
  identifyOverride?: (call: HostCall) => Response | Promise<Response>
  logoutOverride?: (call: HostCall) => Response | Promise<Response>
  rpcOverride?: (endpoint: string, envelope: { rpcId: string }, call: HostCall) => Response | Promise<Response>
  uploadOverride?: (call: HostCall) => Response | Promise<Response>

  readonly fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const call: HostCall = {
      url,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: init?.body,
      signal: init?.signal ?? undefined,
    }
    this.calls.push(call)
    if (url.pathname === '/connect') {
      if (call.method === 'POST') {
        return this.loginOverride !== undefined ? this.loginOverride(call) : this.identityResponse(this.loginStatus, true)
      }
      if (call.method === 'HEAD') {
        return this.identifyOverride !== undefined ? this.identifyOverride(call) : this.identityResponse(this.identifyStatus, false)
      }
      if (call.method === 'DELETE') {
        return this.logoutOverride !== undefined ? this.logoutOverride(call) : new Response(null, { status: this.logoutStatus })
      }
    }
    if (url.pathname === '/api/session/uploadFileBinary') {
      return this.uploadOverride !== undefined
        ? this.uploadOverride(call)
        : Response.json({ ok: true, value: { receiptId: 'receipt-1' } })
    }
    if (url.pathname.startsWith('/api/')) {
      const endpoint = url.pathname.slice('/api/'.length)
      const envelope = JSON.parse(String(call.body)) as { rpcId: string }
      if (this.rpcOverride !== undefined) return this.rpcOverride(endpoint, envelope, call)
      return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result: this.results.get(endpoint) ?? { ok: true } })
    }
    throw new Error(`connect test: unexpected fetch ${call.method} ${url.href}`)
  }

  private identityResponse(status: number, cookie: boolean): Response {
    return new Response(null, {
      status,
      headers: {
        [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION,
        [DEVICE_HOST_HEADER]: 'host-1',
        [DEVICE_EPOCH_HEADER]: this.epoch,
        ...(cookie ? { 'set-cookie': '__Host-ocean-device=login-cookie; Secure; HttpOnly' } : {}),
      },
    })
  }

  callsTo(method: string, pathname: string): HostCall[] {
    return this.calls.filter(call => call.method === method && call.url.pathname === pathname)
  }
}

const HOST_URL = 'https://host.example/'
const TOKEN_ENV = 'OCEAN_CONNECT_TEST_TOKEN'
const GENERIC_FAILURE = 'ocean connect: remote request failed. Check the HTTPS address, certificate, token and protocol version.'
const UNKNOWN_RESULT = 'ocean connect: command result is unknown. Inspect remote session state before retrying.'
const TOKEN_FAILURE = 'ocean connect: could not read a device token from standard input.'

let boot: DeviceBoot | undefined
let host: ScriptedHost
let sockets: FakeSocket[]
let socketBehavior: 'manual' | 'drop-after-open' | 'fail-open'
let workDir: string | undefined
const logs: string[] = []
const errors: string[] = []
const originalStdin = Object.getOwnPropertyDescriptor(process, 'stdin')

beforeEach(() => {
  host = new ScriptedHost()
  sockets = []
  socketBehavior = 'manual'
  carrier.delays.length = 0
  carrier.holdDelay = false
  carrier.openSocket = (url, cookie) => {
    const socket = new FakeSocket(url, cookie)
    sockets.push(socket)
    queueMicrotask(() => {
      if (socketBehavior === 'fail-open') socket.fail()
      else {
        socket.open()
        if (socketBehavior === 'drop-after-open') socket.drop()
      }
    })
    return socket
  }
  vi.stubGlobal('fetch', host.fetch)
  vi.stubEnv(TOKEN_ENV, 'device-token')
  vi.spyOn(console, 'log').mockImplementation((message: unknown) => { logs.push(String(message)) })
  vi.spyOn(console, 'error').mockImplementation((message: unknown) => { errors.push(String(message)) })
})

afterEach(async () => {
  await boot?.dispose()
  boot = undefined
  if (originalStdin !== undefined) Object.defineProperty(process, 'stdin', originalStdin)
  if (workDir !== undefined) await rm(workDir, { recursive: true, force: true })
  workDir = undefined
  carrier.openSocket = undefined
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  logs.length = 0
  errors.length = 0
  internals.stdout = process.stdout
  internals.stderr = process.stderr
})

/** Boot one connect invocation with the scripted Host and an environment token. */
async function bootConnect(args: string[], options?: { holdReady?: boolean }): Promise<DeviceBoot> {
  boot = await bootDeviceProfile('connect', ['--url', HOST_URL, '--token-env', TOKEN_ENV, ...args], options)
  return boot
}

/** Replace process stdin with a test-owned stream. */
function stubStdin(stream: Readable): void {
  Object.defineProperty(process, 'stdin', { value: stream, configurable: true, writable: true })
}

/** Wait for the mux to open one logical stream and return its open frame. */
async function openedStream(socket: FakeSocket): Promise<{ streamId: string; endpoint: string; payload: unknown }> {
  await vi.waitFor(() => { expect(socket.sent.length).toBeGreaterThan(0) })
  const frame = JSON.parse(socket.sent[0]!) as { type: string; streamId: string; endpoint: string; payload: unknown }
  expect(frame.type).toBe('open')
  return frame
}

/** Send one downlink item on the open logical stream. */
function item(socket: FakeSocket, streamId: string, value: unknown): void {
  socket.receive({ type: 'item', streamId, value })
}

/** Decode one recorded unary request envelope. */
function envelopeOf(call: HostCall): { type: string; method: string; rpcId: string; payload: unknown } {
  return JSON.parse(String(call.body)) as { type: string; method: string; rpcId: string; payload: unknown }
}

describe('connect token acquisition', () => {
  it('rejects --token-stdin on a terminal', async () => {
    stubStdin(Object.assign(new PassThrough(), { isTTY: true }))
    boot = await bootDeviceProfile('connect', ['--url', HOST_URL, '--token-stdin', 'list'])
    expect(boot.exits).toEqual([1])
    expect(boot.observed.err).toContain('--token-stdin requires a pipe or redirected input')
    expect(host.calls).toEqual([])
  })

  it.each([['empty', ''], ['unset', undefined]] as const)('rejects a %s token environment variable', async (_kind, value) => {
    vi.stubEnv(TOKEN_ENV, value)
    boot = await bootConnect(['list'])
    expect(boot.exits).toEqual([1])
    expect(boot.observed.err).toContain('the configured token environment variable is empty')
    expect(host.calls).toEqual([])
  })

  it('reads and trims the token from redirected stdin', async () => {
    const stdin = new PassThrough()
    stubStdin(stdin)
    boot = await bootDeviceProfile('connect', ['--url', HOST_URL, '--token-stdin', 'list'])
    stdin.end('  device-token  \n')
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(host.callsTo('POST', '/connect')[0]!.headers.get('authorization')).toBe('Bearer device-token')
  })

  it.each([
    { description: 'oversized input', feed: (stdin: PassThrough) => { stdin.end('x'.repeat(257)) } },
    { description: 'empty input', feed: (stdin: PassThrough) => { stdin.end('\n') } },
  ])('fails on $description from stdin', async ({ feed }) => {
    const stdin = new PassThrough()
    stubStdin(stdin)
    boot = await bootDeviceProfile('connect', ['--url', HOST_URL, '--token-stdin', 'list'])
    feed(stdin)
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([TOKEN_FAILURE])
    expect(host.calls).toEqual([])
  })

  it('fails on a non-string stdin chunk', async () => {
    stubStdin(Readable.from([{ not: 'text' }], { objectMode: true }))
    boot = await bootDeviceProfile('connect', ['--url', HOST_URL, '--token-stdin', 'list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([TOKEN_FAILURE])
  })

  it('stays silent when disposal aborts a pending stdin read', async () => {
    const stdin = new PassThrough()
    stubStdin(stdin)
    boot = await bootDeviceProfile('connect', ['--url', HOST_URL, '--token-stdin', 'list'], { holdReady: true })
    boot.commit()
    await boot.dispose()
    boot = undefined
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors).toEqual([])
    expect(host.calls).toEqual([])
  })

  it('requires the profile launcher', () => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    provideCmdline(ctx, { args: ['--url', HOST_URL, '--token-env', TOKEN_ENV, 'list'], exit: () => {} })
    expect(() => { runDeviceConnect(ctx) }).toThrow('ocean connect requires the profile launcher')
  })
})

describe('connect unary commands', () => {
  it.each([
    { args: ['list'], endpoint: 'session/list', payload: { args: { _request: {} } }, value: [{ id: 's1' }] },
    { args: ['create'], endpoint: 'session/create', payload: { args: { request: {} } }, value: { id: 's1' } },
    { args: ['create', '--cwd', '/work'], endpoint: 'session/create', payload: { args: { request: { cwd: '/work' } } }, value: { id: 's1' } },
    { args: ['history', 's1'], endpoint: 'session/events',
      payload: { args: { request: { address: { kind: 'session', sessionId: 's1' } } } }, value: { events: [] } },
    { args: ['history', 's1', '--before-seq', '7'], endpoint: 'session/events',
      payload: { args: { request: { address: { kind: 'session', sessionId: 's1' }, beforeSeq: 7 } } }, value: { events: [] } },
    { args: ['state', 's1'], endpoint: 'session/state', payload: { args: { request: { sessionId: 's1' } } }, value: { idle: true } },
    { args: ['wait', 's1'], endpoint: 'session/wait', payload: { args: { request: { sessionId: 's1', timeoutMs: 15_000 } } }, value: { idle: true } },
    { args: ['files', 's1'], endpoint: 'workspaceFiles/list', payload: { args: { workspaceFileScopeId: 's1', path: '.' } }, value: [] },
    { args: ['files', 's1', 'src'], endpoint: 'workspaceFiles/list', payload: { args: { workspaceFileScopeId: 's1', path: 'src' } }, value: [] },
    { args: ['read', 's1', 'a.ts'], endpoint: 'workspaceFiles/read',
      payload: { args: { workspaceFileScopeId: 's1', path: 'a.ts', range: {} } }, value: { lines: [] } },
    { args: ['read', 's1', 'a.ts', '--offset', '2', '--limit', '5'], endpoint: 'workspaceFiles/read',
      payload: { args: { workspaceFileScopeId: 's1', path: 'a.ts', range: { offset: 2, limit: 5 } } }, value: { lines: [] } },
    { args: ['terminals', 's1'], endpoint: 'terminal/list', payload: { args: { sessionId: 's1' } }, value: [] },
    { args: ['terminal-close', 's1', 't1'], endpoint: 'terminal/close', payload: { args: { agentId: 's1', id: 't1' } }, value: true },
    { args: ['approvals', 's1'], endpoint: 'deviceApproval/list', payload: { args: { sessionId: 's1' } }, value: [] },
    { args: ['questions', 's1'], endpoint: 'deviceQuestion/list', payload: { args: { sessionId: 's1' } }, value: [] },
    { args: ['cancel', 's1'], endpoint: 'session/cancel', payload: { args: { request: { sessionId: 's1' } } }, value: undefined },
  ])('runs $args and prints the Host value', async ({ args, endpoint, payload, value }) => {
    host.results.set(endpoint, { ok: true, value })
    boot = await bootConnect(args)
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const login = host.callsTo('POST', '/connect')
    expect(login).toHaveLength(1)
    expect(login[0]!.headers.get('authorization')).toBe('Bearer device-token')
    const rpc = host.callsTo('POST', `/api/${endpoint}`)
    expect(rpc).toHaveLength(1)
    expect(rpc[0]!.headers.get('cookie')).toBe('__Host-ocean-device=login-cookie')
    const envelope = envelopeOf(rpc[0]!)
    expect(envelope.type).toBe('client-request')
    expect(envelope.method).toBe(endpoint)
    expect(envelope.rpcId).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u)
    expect(envelope.payload).toEqual(payload)
    expect(host.callsTo('DELETE', '/connect')).toHaveLength(1)
    expect(logs).toEqual([JSON.stringify(value ?? null)])
    expect(errors).toEqual([])
  })

  it.each([
    { args: ['history', 's1', '--before-seq', '-1'], message: '--before-seq must be a non-negative integer' },
    { args: ['history', 's1', '--before-seq', 'abc'], message: '--before-seq must be a non-negative integer' },
    { args: ['history', 's1', '--before-seq', '1.5'], message: '--before-seq must be a non-negative integer' },
    { args: ['history', 's1', '--before-seq', '9007199254740992'], message: '--before-seq must be a non-negative integer' },
    { args: ['read', 's1', 'a.ts', '--offset', '0'], message: '--offset must be a positive integer' },
    { args: ['read', 's1', 'a.ts', '--offset', 'abc'], message: '--offset must be a positive integer' },
    { args: ['read', 's1', 'a.ts', '--limit', '0'], message: '--limit must be a positive integer' },
    { args: ['terminal-write', 's1', 't1', ''], message: 'terminal input must not be empty' },
    { args: ['terminal-create', 's1', '--id', 'bad id!'], message: 'invalid terminal ID' },
    { args: ['prompt', 's1', 'hello', '--request-id', 'not-a-uuid'], message: 'provide non-empty prompt text and a UUID request ID' },
    { args: ['prompt', 's1', '   '], message: 'provide non-empty prompt text and a UUID request ID' },
    { args: ['approve', 's1', 'a1', 'maybe'], message: 'approval decision must be allow or deny' },
    { args: ['answer-question', 's1', 'q1', 'not-json'], message: 'expected a JSON answer' },
  ])('rejects $args before contacting the Host', async ({ args, message }) => {
    boot = await bootConnect(args)
    expect(boot.exits).toEqual([1])
    expect(boot.observed.err).toContain(message)
    expect(host.calls).toEqual([])
  })

  it.each([
    { code: 'session/absent', printed: 'session/absent' },
    { code: 'bad code!', printed: 'unknown' },
  ])('reports a Host refusal with code $code', async ({ code, printed }) => {
    host.results.set('session/list', { ok: false, error: { code, message: 'refused', details: {} } })
    boot = await bootConnect(['list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([`ocean connect: Host rejected session/list (${printed}).`])
    expect(host.callsTo('DELETE', '/connect')).toHaveLength(1)
  })

  it.each([
    { description: 'an error status with a body', response: () => new Response('busy', { status: 503 }) },
    { description: 'an error status without a body', response: () => new Response(null, { status: 500 }) },
    { description: 'an invalid envelope', response: () => Response.json({ type: 'wrong' }) },
    { description: 'a mismatched rpcId', response: () => Response.json({ type: 'server-response', rpcId: 'other', result: { ok: true } }) },
  ])('fails the command on $description', async ({ response }) => {
    host.rpcOverride = () => response()
    boot = await bootConnect(['list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([GENERIC_FAILURE])
  })

  it('fails the command when the Host rejects the token', async () => {
    host.loginStatus = 401
    boot = await bootConnect(['list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([GENERIC_FAILURE])
    expect(host.callsTo('POST', '/api/session/list')).toEqual([])
  })

  it('fails the command on a network failure', async () => {
    host.rpcOverride = () => { throw new Error('network down') }
    boot = await bootConnect(['list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([GENERIC_FAILURE])
  })

  it('keeps the command result when logout fails', async () => {
    host.results.set('session/list', { ok: true, value: [] })
    host.logoutStatus = 500
    boot = await bootConnect(['list'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual(['[]'])
    expect(errors).toEqual(['ocean connect: could not close the remote login. It will expire on the Host.'])
  })

  it('stays silent when disposal aborts an in-flight request', async () => {
    host.rpcOverride = (_endpoint, _envelope, call) => new Promise<Response>((_resolve, reject) => {
      // AbortSignal.reason belongs to the aborting caller and may be a non-Error sentinel.
      call.signal?.addEventListener('abort', () => { reject(call.signal!.reason) }, { once: true })
    })
    boot = await bootConnect(['list'], { holdReady: true })
    boot.commit()
    await vi.waitFor(() => { expect(host.callsTo('POST', '/api/session/list')).toHaveLength(1) })
    await boot.dispose()
    boot = undefined
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors).toEqual([])
    expect(host.callsTo('DELETE', '/connect')).toEqual([])
  })

  it('discards a late result after disposal without logging out', async () => {
    let finish: (() => void) | undefined
    host.rpcOverride = (_endpoint, envelope) => new Promise<Response>((resolve) => {
      finish = () => { resolve(Response.json({ type: 'server-response', rpcId: envelope.rpcId, result: { ok: true, value: [] } })) }
    })
    boot = await bootConnect(['list'], { holdReady: true })
    boot.commit()
    await vi.waitFor(() => { expect(finish).toBeDefined() })
    await boot.dispose()
    boot = undefined
    finish!()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(logs).toEqual([])
    expect(errors).toEqual([])
    expect(host.callsTo('DELETE', '/connect')).toEqual([])
  })

  it('runs nothing before startup commits and detaches on disposal', async () => {
    boot = await bootConnect(['list'], { holdReady: true })
    const held = boot
    await boot.dispose()
    boot = undefined
    held.commit()
    expect(host.calls).toEqual([])
    expect(held.exits).toEqual([])
  })
})

describe('connect question projections', () => {
  it.each([
    { description: 'a null projection', value: null, printed: [] },
    { description: 'values without questions', value: { kind: 'sequenced', values: {} }, printed: [] },
    { description: 'mixed active rows', value: { kind: 'sequenced', values: { userQuestions: { active: [
      { state: 'continued', id: 'q1' }, { state: 'pending' }, null, 42, 'x', { noState: true }, { state: 'continued', id: 'q2' },
    ] } } }, printed: [{ state: 'continued', id: 'q1' }, { state: 'continued', id: 'q2' }] },
  ])('prints the continued questions for $description', async ({ value, printed }) => {
    host.results.set('session/projections', { ok: true, value })
    boot = await bootConnect(['questions', 's1', '--continued'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual([JSON.stringify(printed)])
  })

  it.each([
    { description: 'a non-object', value: 'text' },
    { description: 'a wrong kind', value: { kind: 'other' } },
    { description: 'missing values', value: { kind: 'sequenced' } },
    { description: 'null values', value: { kind: 'sequenced', values: null } },
    { description: 'non-object values', value: { kind: 'sequenced', values: 5 } },
    { description: 'null questions', value: { kind: 'sequenced', values: { userQuestions: null } } },
    { description: 'non-object questions', value: { kind: 'sequenced', values: { userQuestions: 'x' } } },
    { description: 'questions without active', value: { kind: 'sequenced', values: { userQuestions: {} } } },
    { description: 'a non-array active', value: { kind: 'sequenced', values: { userQuestions: { active: 'x' } } } },
  ])('fails the command on $description', async ({ value }) => {
    host.results.set('session/projections', { ok: true, value })
    boot = await bootConnect(['questions', 's1', '--continued'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([GENERIC_FAILURE])
  })
})

describe('connect answers and approvals', () => {
  it.each([
    { answer: 'true', accepted: true },
    { answer: 'false', accepted: false },
  ])('answers a continued question with $answer', async ({ answer, accepted }) => {
    host.results.set('userQuestions/answer', { ok: true, value: accepted })
    boot = await bootConnect(['answer-question', 's1', 'q1', answer, '--continued'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const rpc = host.callsTo('POST', '/api/userQuestions/answer')[0]!
    expect(envelopeOf(rpc).payload).toEqual({ args: { agentId: 's1', callId: 'q1', answer: accepted } })
    expect(logs).toEqual([JSON.stringify({ accepted })])
  })

  it('reports an unknown result when a continued answer is not boolean', async () => {
    host.results.set('userQuestions/answer', { ok: true, value: 'text' })
    boot = await bootConnect(['answer-question', 's1', 'q1', '"text"', '--continued'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([UNKNOWN_RESULT])
  })

  it('answers a pending question with structured JSON', async () => {
    host.results.set('deviceQuestion/answer', { ok: true, value: { accepted: true } })
    boot = await bootConnect(['answer-question', 's1', 'q1', '{"choice":1}'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const rpc = host.callsTo('POST', '/api/deviceQuestion/answer')[0]!
    expect(envelopeOf(rpc).payload).toEqual({ args: { sessionId: 's1', id: 'q1', answer: { choice: 1 } } })
  })

  it.each([
    { decision: 'allow', allow: true },
    { decision: 'deny', allow: false },
  ])('approves with $decision', async ({ decision, allow }) => {
    host.results.set('deviceApproval/answer', { ok: true, value: true })
    boot = await bootConnect(['approve', 's1', 'a1', decision])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const rpc = host.callsTo('POST', '/api/deviceApproval/answer')[0]!
    expect(envelopeOf(rpc).payload).toEqual({ args: { sessionId: 's1', id: 'a1', allow } })
  })
})

describe('connect prompt and terminal creation', () => {
  const REQUEST_ID = '01234567-89ab-4def-8123-456789abcdef'

  it('submits a prompt with a reused request ID', async () => {
    host.results.set('session/prompt', { ok: true, value: { queued: true } })
    boot = await bootConnect(['prompt', 's1', 'hello', '--request-id', REQUEST_ID])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(errors).toEqual([`ocean connect: request ID ${REQUEST_ID}`])
    const rpc = host.callsTo('POST', '/api/session/prompt')[0]!
    expect(envelopeOf(rpc).payload).toEqual({ args: { request: {
      requestId: REQUEST_ID, sessionId: 's1', mode: 'queue', content: [{ type: 'text', text: 'hello' }],
    } } })
  })

  it('steers the active turn and attaches uploaded files', async () => {
    host.results.set('session/prompt', { ok: true, value: { queued: true } })
    boot = await bootConnect(['prompt', 's1', 'hello', '--steer', '--file', 'r1', 'r2'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const rpc = host.callsTo('POST', '/api/session/prompt')[0]!
    const request = (envelopeOf(rpc).payload as { args: { request: { requestId: string; mode: string; content: unknown[] } } })
      .args.request
    expect(request.requestId).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u)
    expect(request.mode).toBe('steer')
    expect(request.content).toEqual([
      { type: 'text', text: 'hello' }, { type: 'file', receiptId: 'r1' }, { type: 'file', receiptId: 'r2' },
    ])
    expect(errors).toEqual([`ocean connect: request ID ${request.requestId}`])
  })

  it('reports an unknown prompt result with its retry ID', async () => {
    host.rpcOverride = () => { throw new Error('network down') }
    boot = await bootConnect(['prompt', 's1', 'hello', '--request-id', REQUEST_ID])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([
      `ocean connect: request ID ${REQUEST_ID}`,
      `ocean connect: prompt result is unknown. To retry the same prompt, reuse request ID ${REQUEST_ID} with --request-id.`,
    ])
  })

  it('creates a terminal with a reused identity', async () => {
    host.results.set('terminal/create', { ok: true, value: { id: 'term-1' } })
    boot = await bootConnect(['terminal-create', 's1', '--id', 'term-1'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(errors).toEqual(['ocean connect: request ID term-1'])
    const rpc = host.callsTo('POST', '/api/terminal/create')[0]!
    expect(envelopeOf(rpc).payload).toEqual({ args: { agentId: 's1', request: { id: 'term-1', cols: 80, rows: 24 } } })
  })

  it('mints a terminal identity when none is reused', async () => {
    host.results.set('terminal/create', { ok: true, value: { id: 'minted' } })
    boot = await bootConnect(['terminal-create', 's1'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const rpc = host.callsTo('POST', '/api/terminal/create')[0]!
    const request = (envelopeOf(rpc).payload as { args: { request: { id: string } } }).args.request
    expect(request.id).toMatch(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u)
  })

  it('reports an unknown terminal creation result with its identity', async () => {
    host.rpcOverride = () => { throw new Error('network down') }
    boot = await bootConnect(['terminal-create', 's1', '--id', 'term-1'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([
      'ocean connect: request ID term-1',
      'ocean connect: terminal creation result is unknown. List the Host terminals and look for ID term-1 before retrying.',
    ])
  })
})

describe('connect upload', () => {
  it('streams a local file and prints its receipt', async () => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    const path = join(workDir, 'note.txt')
    await writeFile(path, 'hello')
    host.uploadOverride = () => Response.json({ ok: true, value: { receiptId: 'r1', name: 'note.txt' } })
    boot = await bootConnect(['upload', 's1', path])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    const upload = host.callsTo('POST', '/api/session/uploadFileBinary')[0]!
    expect(upload.url.searchParams.get('sessionId')).toBe('s1')
    expect(upload.url.searchParams.get('name')).toBe('note.txt')
    expect(upload.headers.get('cookie')).toBe('__Host-ocean-device=login-cookie')
    expect(await (upload.body as Blob).text()).toBe('hello')
    expect(logs).toEqual([JSON.stringify({ receiptId: 'r1', name: 'note.txt' })])
  })

  it.each([
    { description: 'a directory', target: 'dir', error: 'local/not-a-file' },
    { description: 'a missing file', target: 'absent.txt', error: 'local/file-unavailable' },
  ])('refuses $description before contacting the Host', async ({ target, error }) => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    if (target === 'dir') await mkdir(join(workDir, target))
    boot = await bootConnect(['upload', 's1', join(workDir, target)])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([`ocean connect: could not open the local file (${error}).`])
    expect(host.callsTo('POST', '/api/session/uploadFileBinary')).toEqual([])
  })

  it.each([
    { status: 404, body: null, printed: 'http/404' },
    { status: 403, body: 'forbidden', printed: 'http/403' },
  ])('reports an upload refusal with status $status', async ({ status, body, printed }) => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    const path = join(workDir, 'note.txt')
    await writeFile(path, 'hello')
    host.uploadOverride = () => new Response(body, { status })
    boot = await bootConnect(['upload', 's1', path])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([`ocean connect: Host rejected upload (${printed}).`])
  })

  it('reports an unknown upload result on a server failure', async () => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    const path = join(workDir, 'note.txt')
    await writeFile(path, 'hello')
    host.uploadOverride = () => new Response(null, { status: 500 })
    boot = await bootConnect(['upload', 's1', path])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual(['ocean connect: upload result is unknown. No attachment receipt was confirmed.'])
  })

  it.each([
    { description: 'a null body', body: null },
    { description: 'an empty object', body: {} },
    { description: 'ok without a value', body: { ok: true } },
    { description: 'a null value', body: { ok: true, value: null } },
    { description: 'a value without a receipt', body: { ok: true, value: {} } },
    { description: 'a non-string receipt', body: { ok: true, value: { receiptId: 5 } } },
    { description: 'a failure without an error', body: { ok: false } },
    { description: 'a null error', body: { ok: false, error: null } },
    { description: 'an error without a code', body: { ok: false, error: {} } },
    { description: 'a non-boolean ok', body: { ok: 'yes' } },
  ])('reports an unknown upload result for $description', async ({ body }) => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    const path = join(workDir, 'note.txt')
    await writeFile(path, 'hello')
    host.uploadOverride = () => Response.json(body)
    boot = await bootConnect(['upload', 's1', path])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual(['ocean connect: upload result is unknown. No attachment receipt was confirmed.'])
  })

  it.each([
    { code: 'upload/too-large', printed: 'upload/too-large' },
    { code: 'bad code!', printed: 'unknown' },
    { code: 42, printed: 'unknown' },
  ])('reports an upload refusal with code $code', async ({ code, printed }) => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    const path = join(workDir, 'note.txt')
    await writeFile(path, 'hello')
    host.uploadOverride = () => Response.json({ ok: false, error: { code } })
    boot = await bootConnect(['upload', 's1', path])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([`ocean connect: Host rejected upload (${printed}).`])
  })

  it('stays silent when disposal aborts the upload before submission', async () => {
    workDir = await mkdtemp(join(tmpdir(), 'ocean-connect-upload-'))
    const path = join(workDir, 'note.txt')
    await writeFile(path, 'hello')
    boot = await bootConnect(['upload', 's1', path], { holdReady: true })
    boot.commit()
    await boot.dispose()
    boot = undefined
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors).toEqual([])
    expect(host.callsTo('POST', '/api/session/uploadFileBinary')).toEqual([])
  })
})

describe('connect streams', () => {
  it('prints every follow frame and exits when the stream ends', async () => {
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const { streamId, endpoint, payload } = await openedStream(sockets[0]!)
    expect(endpoint).toBe('session/follow')
    expect(payload).toEqual({ args: { request: { address: { kind: 'session', sessionId: 's1' } } } })
    const frames = [{ type: 'snapshot', sessions: [] }, null, 42, 'text', { other: true }]
    for (const frame of frames) item(sockets[0]!, streamId, frame)
    sockets[0]!.receive({ type: 'end', streamId })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual(frames.map(frame => JSON.stringify(frame)))
    expect(errors).toEqual([])
    expect(carrier.delays).toEqual([])
  })

  it('reconnects after a carrier interruption and resumes from a fresh snapshot', async () => {
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot', n: 1 })
    await vi.waitFor(() => { expect(logs).toEqual([JSON.stringify({ type: 'snapshot', n: 1 })]) })
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(sockets).toHaveLength(2) })
    const second = await openedStream(sockets[1]!)
    item(sockets[1]!, second.streamId, { type: 'snapshot', n: 2 })
    sockets[1]!.receive({ type: 'end', streamId: second.streamId })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(errors).toEqual(['ocean connect: stream interrupted. Waiting for a fresh snapshot.'])
    expect(carrier.delays).toHaveLength(1)
    expect(carrier.delays[0]!).toBeGreaterThanOrEqual(125)
    expect(carrier.delays[0]!).toBeLessThanOrEqual(250)
    expect(host.callsTo('HEAD', '/connect')).toHaveLength(1)
    expect(logs).toEqual([JSON.stringify({ type: 'snapshot', n: 1 }), JSON.stringify({ type: 'snapshot', n: 2 })])
  })

  it('keeps following a session across a Host restart', async () => {
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    host.epoch = 'epoch-2'
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(sockets).toHaveLength(2) })
    const second = await openedStream(sockets[1]!)
    sockets[1]!.receive({ type: 'end', streamId: second.streamId })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(errors).toEqual(['ocean connect: stream interrupted. Waiting for a fresh snapshot.'])
  })

  it('refuses to reattach a terminal after the Host restarted', async () => {
    boot = await bootConnect(['terminal-watch', 's1', 't1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    expect(first.endpoint).toBe('terminal/attach')
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    host.epoch = 'epoch-2'
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([
      'ocean connect: stream interrupted. Waiting for a fresh snapshot.',
      'ocean connect: Host restarted. List its terminals before attaching again.',
      GENERIC_FAILURE,
    ])
  })

  it('gives up after exhausted reconnect attempts', async () => {
    socketBehavior = 'fail-open'
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(sockets).toHaveLength(6)
    expect(carrier.delays).toHaveLength(5)
    const bounds = [[125, 250], [250, 500], [500, 1000], [1000, 2000], [2000, 4000]]
    carrier.delays.forEach((delay, index) => {
      expect(delay).toBeGreaterThanOrEqual(bounds[index]![0]!)
      expect(delay).toBeLessThanOrEqual(bounds[index]![1]!)
    })
    expect(errors).toEqual([
      ...Array.from({ length: 6 }, () => 'ocean connect: stream interrupted. Waiting for a fresh snapshot.'),
      GENERIC_FAILURE,
    ])
  })

  it.each([
    { description: 'an unavailable session', identify: () => new Response(null, { status: 503 }) },
    { description: 'a connection failure', identify: () => { throw new Error('network down') } },
  ])('retries reconnect after $description', async ({ identify }) => {
    let attempts = 0
    host.identifyOverride = () => {
      attempts += 1
      return attempts === 1 ? identify() : new Response(null, {
        status: 204,
        headers: {
          [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION,
          [DEVICE_HOST_HEADER]: 'host-1',
          [DEVICE_EPOCH_HEADER]: host.epoch,
        },
      })
    }
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(sockets).toHaveLength(2) })
    const second = await openedStream(sockets[1]!)
    sockets[1]!.receive({ type: 'end', streamId: second.streamId })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(carrier.delays).toHaveLength(2)
    expect(attempts).toBe(2)
  })

  it('retries reconnect after the identify check times out', { timeout: 15_000 }, async () => {
    let attempts = 0
    host.identifyOverride = (call) => {
      attempts += 1
      if (attempts > 1) {
        return new Response(null, {
          status: 204,
          headers: {
            [DEVICE_PROTOCOL_HEADER]: DEVICE_PROTOCOL_VERSION,
            [DEVICE_HOST_HEADER]: 'host-1',
            [DEVICE_EPOCH_HEADER]: host.epoch,
          },
        })
      }
      // Hold the first identify until its own 5s check signal times out.
      return new Promise<Response>((_resolve, reject) => {
        // AbortSignal.reason belongs to the aborting caller and may be a non-Error sentinel.
        call.signal!.addEventListener('abort', () => { reject(call.signal!.reason) }, { once: true })
      })
    }
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(sockets).toHaveLength(2) }, { timeout: 10_000 })
    const second = await openedStream(sockets[1]!)
    sockets[1]!.receive({ type: 'end', streamId: second.streamId })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(carrier.delays).toHaveLength(2)
    expect(attempts).toBe(2)
  })

  it('ends the command when the session is rejected during reconnect', async () => {
    host.identifyOverride = () => new Response(null, { status: 401 })
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([
      'ocean connect: stream interrupted. Waiting for a fresh snapshot.',
      'ocean connect: the remote session ended. Run the command again with an active device token.',
    ])
  })

  it('fails the command when identify reports an unexpected failure', async () => {
    host.identifyOverride = () => new Response(null, { status: 500 })
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([
      'ocean connect: stream interrupted. Waiting for a fresh snapshot.',
      GENERIC_FAILURE,
    ])
  })

  it('fails the command on a remote stream error frame', async () => {
    boot = await bootConnect(['follow', 's1'])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const { streamId } = await openedStream(sockets[0]!)
    sockets[0]!.receive({ type: 'error', streamId, error: { code: 'session/absent', message: 'gone', details: {} } })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([GENERIC_FAILURE])
    expect(carrier.delays).toEqual([])
  })

  it('stays silent when disposal aborts the reconnect wait', async () => {
    carrier.holdDelay = true
    boot = await bootConnect(['follow', 's1'], { holdReady: true })
    boot.commit()
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const first = await openedStream(sockets[0]!)
    item(sockets[0]!, first.streamId, { type: 'snapshot' })
    sockets[0]!.drop()
    await vi.waitFor(() => { expect(carrier.delays).toHaveLength(1) })
    await boot.dispose()
    boot = undefined
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors).toEqual(['ocean connect: stream interrupted. Waiting for a fresh snapshot.'])
  })

  it('stops without retrying when the carrier fails during disposal', async () => {
    boot = await bootConnect(['follow', 's1'], { holdReady: true })
    boot.ctx.effect(() => () => { sockets[0]?.drop() }, 'connect test: drop carrier on disposal')
    boot.commit()
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    await openedStream(sockets[0]!)
    await boot.dispose()
    boot = undefined
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(errors).toEqual([])
    expect(sockets).toHaveLength(1)
  })
})

describe('connect terminal writes', () => {
  /** Drive one terminal-write up to its first snapshot and return the stream id. */
  async function startWrite(text: string): Promise<{ socket: FakeSocket; streamId: string }> {
    boot = await bootConnect(['terminal-write', 's1', 't1', text])
    await vi.waitFor(() => { expect(sockets).toHaveLength(1) })
    const { streamId, endpoint, payload } = await openedStream(sockets[0]!)
    expect(endpoint).toBe('terminal/attach')
    expect(payload).toEqual({ args: { agentId: 's1', id: 't1' } })
    return { socket: sockets[0]!, streamId }
  }

  it('sends one input after a writable snapshot and waits for acceptance', async () => {
    const { socket, streamId } = await startWrite('hello')
    item(socket, streamId, { type: 'snapshot', writable: true })
    await vi.waitFor(() => { expect(socket.sent.length).toBe(3) })
    expect(JSON.parse(socket.sent[1]!)).toEqual({ type: 'item', streamId, value: { type: 'write', sequence: 1, data: 'hello', typed: true } })
    expect(JSON.parse(socket.sent[2]!)).toEqual({ type: 'end', streamId })
    socket.receive({ type: 'item', streamId, value: { type: 'ack', sequence: 1 } })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual([JSON.stringify({ accepted: true })])
  })

  it.each([
    { description: 'a snapshot without writable', snapshot: { type: 'snapshot' } },
    { description: 'a read-only snapshot', snapshot: { type: 'snapshot', writable: false } },
  ])('refuses input on $description', async ({ snapshot }) => {
    const { socket, streamId } = await startWrite('hello')
    item(socket, streamId, snapshot)
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual(['ocean connect: Host rejected terminal/attach (terminal/read-only).'])
    expect(socket.sent).toHaveLength(2)
    expect((JSON.parse(socket.sent[1]!) as { type: string }).type).toBe('cancel')
  })

  it('reports a refused input', async () => {
    const { socket, streamId } = await startWrite('hello')
    item(socket, streamId, { type: 'snapshot', writable: true })
    await vi.waitFor(() => { expect(socket.sent.length).toBe(3) })
    socket.receive({ type: 'item', streamId, value: { type: 'ack', sequence: 1, refusal: { reason: 'closed' } } })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual(['ocean connect: Host rejected terminal/attach (terminal/input-refused).'])
  })

  it('reports an unknown result when the stream ends before acknowledging', async () => {
    const { socket, streamId } = await startWrite('hello')
    item(socket, streamId, { type: 'snapshot', writable: true })
    await vi.waitFor(() => { expect(socket.sent.length).toBe(3) })
    socket.receive({ type: 'end', streamId })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([1]) })
    expect(errors).toEqual([UNKNOWN_RESULT])
  })

  it('ignores frames that are not the writable snapshot or the matching ack', async () => {
    const { socket, streamId } = await startWrite('hello')
    for (const frame of [null, 42, { type: 'other' }, { type: 'ack', sequence: 1 }]) item(socket, streamId, frame)
    item(socket, streamId, { type: 'snapshot', writable: true })
    await vi.waitFor(() => { expect(socket.sent.length).toBe(3) })
    item(socket, streamId, { type: 'ack', sequence: 2 })
    item(socket, streamId, { type: 'snapshot', writable: true })
    socket.receive({ type: 'item', streamId, value: { type: 'ack', sequence: 1 } })
    await vi.waitFor(() => { expect(boot!.exits).toEqual([0]) })
    expect(logs).toEqual([JSON.stringify({ accepted: true })])
    expect(socket.sent).toHaveLength(4)
    expect((JSON.parse(socket.sent[3]!) as { type: string }).type).toBe('cancel')
  })
})
