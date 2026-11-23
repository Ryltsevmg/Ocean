/** Tailscale discovery and the serve mapping, over a scripted `tailscale` command. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  resolveTailscaleHost, startTailscaleServe, tailscale, TailscaleServeError, tailscaleOrigin, type TailscaleRun,
} from '../src/tailscale.ts'

const original = tailscale.run
let calls: (readonly string[])[] = []
let commands: string[] = []

/** Script the next invocations; each call consumes one reply, the last repeats. */
function script(...replies: Partial<TailscaleRun>[]): void {
  calls = []
  commands = []
  tailscale.run = (command, args) => {
    commands.push(command)
    calls.push(args)
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)] ?? {}
    return { status: 0, stdout: '', stderr: '', ...reply }
  }
}

const running = (overrides: Record<string, unknown> = {}): Partial<TailscaleRun> => ({
  stdout: JSON.stringify({
    BackendState: 'Running', Self: { DNSName: 'bigpc.tail71ee4f.ts.net.' }, CertDomains: ['bigpc.tail71ee4f.ts.net'], ...overrides,
  }),
})

const FREE = { stdout: '{}' }
const FREE_STATUS = FREE

beforeEach(() => { calls = []; commands = [] })
afterEach(() => { tailscale.run = original })

it('reads the node name from a running tailnet with HTTPS certificates', () => {
  script(running())
  expect(resolveTailscaleHost('tailscale')).toBe('bigpc.tail71ee4f.ts.net')
  expect(calls).toEqual([['status', '--json']])
  expect(commands).toEqual(['tailscale'])
})

it('runs every command through the executable it was given', () => {
  script(running(), FREE_STATUS, {}, {})
  expect(resolveTailscaleHost('/usr/local/bin/tailscale-sudo')).toBe('bigpc.tail71ee4f.ts.net')
  startTailscaleServe('/usr/local/bin/tailscale-sudo', 8443, 3080)()
  expect(new Set(commands)).toEqual(new Set(['/usr/local/bin/tailscale-sudo']))
  expect(commands).toHaveLength(4)
})

it('names a missing executable in the failure', () => {
  script({ status: null, error: new Error('spawn ENOENT') })
  expect(() => resolveTailscaleHost('/opt/tailscale-sudo')).toThrow('"/opt/tailscale-sudo"')
})

it.each([
  { description: 'a missing tailscale command', reply: { status: null, error: new Error('spawn tailscale ENOENT') }, message: 'could not run "tailscale"' },
  { description: 'a failing status command', reply: { status: 1, stderr: 'permission denied\nmore' }, message: 'Tailscale status: permission denied' },
  { description: 'a failing status command without output', reply: { status: 2 }, message: 'Tailscale status: exit 2' },
  { description: 'output that is not JSON', reply: { stdout: 'not json' }, message: 'did not return JSON' },
  { description: 'a stopped node', reply: running({ BackendState: 'Stopped' }), message: 'tailscale up' },
  { description: 'a node without a DNS name', reply: running({ Self: {} }), message: 'MagicDNS' },
  { description: 'a node whose DNS name is not a string', reply: running({ Self: { DNSName: 1 } }), message: 'MagicDNS' },
  { description: 'a tailnet without HTTPS certificates', reply: running({ CertDomains: [] }), message: 'HTTPS certificates' },
  { description: 'missing certificate domains', reply: running({ CertDomains: undefined }), message: 'HTTPS certificates' },
  { description: 'a JSON null', reply: { stdout: 'null' }, message: 'tailscale up' },
  { description: 'a JSON number', reply: { stdout: '5' }, message: 'tailscale up' },
  { description: 'a null Self record', reply: running({ Self: null }), message: 'MagicDNS' },
])('refuses $description with an actionable message', ({ reply, message }) => {
  script(reply)
  expect(() => resolveTailscaleHost('tailscale')).toThrow(TailscaleServeError)
  expect(() => resolveTailscaleHost('tailscale')).toThrow(message)
})

it('forms the HTTPS root with a port only when it is not 443', () => {
  expect(tailscaleOrigin('bigpc.tail71ee4f.ts.net', 443)).toBe('https://bigpc.tail71ee4f.ts.net/')
  expect(tailscaleOrigin('bigpc.tail71ee4f.ts.net', 8443)).toBe('https://bigpc.tail71ee4f.ts.net:8443/')
})


it('publishes the loopback port in the background and removes the mapping on request', () => {
  script(FREE, {})
  const remove = startTailscaleServe('tailscale', 443, 3080)
  expect(calls).toEqual([['serve', 'status', '--json'], ['serve', '--bg', '--https=443', 'http://127.0.0.1:3080']])
  expect(remove()).toBeUndefined()
  expect(calls.at(-1)).toEqual(['serve', '--https=443', 'off'])
})

it('treats an empty serve status as a free port', () => {
  script({ stdout: '' }, {})
  expect(() => startTailscaleServe('tailscale', 443, 3080)).not.toThrow()
})

it('leaves other ports and unrelated sites alone', () => {
  script({ stdout: JSON.stringify({
    TCP: { 443: { HTTPS: true }, 2222: { TCPForward: '127.0.0.1:22' } },
    Web: { 'bigpc.tail71ee4f.ts.net:443': { Handlers: { '/': { Proxy: 'http://100.72.163.58:49374' } } } },
  }) }, {})
  expect(() => startTailscaleServe('tailscale', 8443, 3080)).not.toThrow()
  expect(calls.at(-1)).toEqual(['serve', '--bg', '--https=8443', 'http://127.0.0.1:3080'])
})

it('accepts a port that already forwards only to this listener', () => {
  script({ stdout: JSON.stringify({
    TCP: { 8443: { HTTPS: true } },
    Web: { 'bigpc.tail71ee4f.ts.net:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:3080' } } } },
  }) }, {})
  expect(() => startTailscaleServe('tailscale', 8443, 3080)).not.toThrow()
})

it.each([
  { description: 'another site', config: { Web: { 'n.ts.net:443': { Handlers: { '/': { Proxy: 'http://100.72.163.58:49374' } } } } } },
  { description: 'a site with extra paths', config: { Web: { 'n.ts.net:443': { Handlers: {
    '/': { Proxy: 'http://127.0.0.1:3080' }, '/files/': { Path: '/srv/files' },
  } } } } },
  { description: 'a different local port', config: { Web: { 'n.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:9999' } } } } } },
  { description: 'a TCP forward', config: { TCP: { 443: { TCPForward: '127.0.0.1:22' } } } },
])('refuses a port used by $description before changing anything', ({ config }) => {
  script({ stdout: JSON.stringify(config) })
  expect(() => startTailscaleServe('tailscale', 443, 3080)).toThrow('already used by another Tailscale mapping')
  expect(() => startTailscaleServe('tailscale', 443, 3080)).toThrow('--tailscale-serve-port')
  expect(calls.every(call => call[1] === 'status')).toBe(true)
})

it.each([
  { description: 'a failing status read', reply: { status: 1, stderr: 'denied\nmore' }, message: 'existing serve configuration: denied' },
  { description: 'a status command that cannot run', reply: { status: null, error: new Error('spawn failed') }, message: 'existing serve configuration: spawn failed' },
  { description: 'a silent status failure', reply: { status: 4 }, message: 'existing serve configuration: exit 4' },
  { description: 'a status that is not JSON', reply: { stdout: 'nope' }, message: 'did not return JSON' },
])('refuses to publish after $description', ({ reply, message }) => {
  script(reply)
  expect(() => startTailscaleServe('tailscale', 443, 3080)).toThrow(message)
  expect(calls).toHaveLength(1)
})

it.each([
  { description: 'a refused mapping', reply: { status: 1, stderr: 'Access denied: serve config denied\nusage' }, reason: 'Access denied: serve config denied' },
  { description: 'a command that cannot run', reply: { status: null, error: new Error('spawn failed') }, reason: 'spawn failed' },
  { description: 'a silent failure', reply: { status: 3 }, reason: 'exit 3' },
])('reports $description without leaving a mapping', ({ reply, reason }) => {
  script(FREE, reply)
  expect(() => startTailscaleServe('tailscale', 8443, 3080)).toThrow(`could not publish port 8443: ${reason}`)
})

it('reports a mapping it cannot remove with the command that removes it', () => {
  script(FREE, {}, { status: 1, stderr: 'busy' })
  const remove = startTailscaleServe('tailscale', 8443, 3080)
  expect(remove()).toContain('tailscale serve --https=8443 off')
})

it('reports a missing binary from the real command', () => {
  const result = original('/nonexistent/tailscale', ['status', '--json'])
  expect(result.error).toBeInstanceOf(Error)
  expect(result.status).toBeNull()
})

it.skipIf(process.platform === 'win32')('runs a real executable and returns its output and exit status', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ocean-tailscale-'))
  try {
    const executable = join(directory, 'tailscale-wrapper')
    writeFileSync(executable, '#!/bin/sh\necho "out:$1"\necho "err:$2" >&2\nexit 3\n', { mode: 0o755 })
    expect(original(executable, ['first', 'second'])).toEqual({ status: 3, stdout: 'out:first\n', stderr: 'err:second\n' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
