/**
 * The Web command-line provider over a real Loader tree: its ordinary service
 * releases a consumer whose config reads `ctx.webStartup` directly.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { internals, provideCmdline } from '@ocean/ocean-cmdline'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, WEB_STARTUP_SERVICE, type WebStartupValues } from '../src/startup.ts'
import { tailscale } from '../src/tailscale.ts'

/** What one fixture boot observed. */
interface Observed {
  exits: number[]
  out: string
  readerConfig?: unknown
}

const disposers: (() => Promise<void>)[] = []

/** Fixture tree roots, removed after their booted tree has been disposed. */
const tempDirs: string[] = []

const originalTailscale = tailscale.run

afterEach(async () => {
  tailscale.run = originalTailscale
  for (const dispose of disposers.splice(0)) await dispose()
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  internals.stdout = process.stdout
  internals.stderr = process.stderr
})

/**
 * Mount the real provider and a consumer using injection-ordered config.
 * @param args - the invocation's inner arguments.
 * @returns the service value and observed consumer/process effects.
 */
async function bootProvider(args: string[], profile?: string): Promise<{
  values: WebStartupValues | undefined
  observed: Observed
}> {
  const dir = mkdtempSync(join(tmpdir(), 'ocean-web-startup-'))
  tempDirs.push(dir)
  const observed: Observed = { exits: [], out: '' }
  writeFileSync(join(dir, 'reader.mjs'), `
export function apply(_ctx, config) { globalThis.__webStartupObserved.readerConfig = config }
`)
  // Node imports the fixture row outside Vite's source resolver, so delegate
  // to the source-plane plugin already imported by this test.
  writeFileSync(join(dir, 'provider.mjs'), `
export const name = 'web-startup'
export const inject = ['cmdlineArgs']
export const apply = ctx => globalThis.__webStartupApply(ctx)
`)
  writeFileSync(join(dir, 'cordis.yml'), [
    '- id: reader',
    `  name: ${pathToFileURL(join(dir, 'reader.mjs')).href}`,
    `  inject: [${WEB_STARTUP_SERVICE}]`,
    '  config:',
    "    host: !!js ctx.webStartup.host ?? '127.0.0.1'",
    '    openBrowser: !!js ctx.webStartup.openBrowser',
    '    port: !!js ctx.webStartup.port ?? 3080',
    '    publicUrl: !!js ctx.webStartup.publicUrl',
    '    tailscaleServePort: !!js ctx.webStartup.tailscaleServePort',
    '    tailscaleCommand: !!js ctx.webStartup.tailscaleCommand',
    '    trustedHosts: !!js ctx.webStartup.trustedHosts',
    '    tls: !!js ctx.webStartup.tls',
    '- id: provider',
    `  name: ${pathToFileURL(join(dir, 'provider.mjs')).href}`,
    '',
  ].join('\n'))
  const observing = { write: (chunk: string) => { observed.out += chunk; return true } }
  internals.stdout = observing
  internals.stderr = observing
  const globals = globalThis as unknown as {
    __webStartupApply: typeof apply
    __webStartupObserved: Observed
  }
  globals.__webStartupApply = apply
  globals.__webStartupObserved = observed

  const ctx = new Context()
  if (profile !== undefined) {
    ctx.provide('profileContext', {
      name: profile, dir, patchPath: join(dir, 'cordis.patch.yml'), installAnchor: join(dir, 'package.json'),
      cwd: dir, home: dir, startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
    })
  }
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  provideCmdline(ctx, { args, exit: code => void observed.exits.push(code) })
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(join(dir, 'cordis.yml')).href } })
  await ctx.loader.await()
  disposers.push(async () => { await ctx.fiber.dispose() })
  return {
    values: ctx.get(WEB_STARTUP_SERVICE) as WebStartupValues | undefined,
    observed,
  }
}

describe('web command-line provider', () => {
  it.each([
    { profile: 'connect', command: 'prompt', description: 'Submit or steer a prompt' },
    { profile: 'remote-device', command: 'create', description: 'Create a device and return its token once' },
    { profile: 'remote-device', command: 'rotate', description: 'Replace a device token' },
    { profile: 'remote-device', command: 'revoke', description: 'Revoke a device and close its live connections' },
  ])('describes $profile $command before startup', async ({ profile, command, description }) => {
    const { values, observed } = await bootProvider([command, '--help'], profile)
    expect(observed.out).toContain(description)
    expect(values).toBeUndefined()
    expect(observed.exits).toEqual([0])
  })

  it.each(['0', '-1', '1.5', '2147483648'])('rejects invalid admin timeout %s before startup', async (timeout) => {
    const { observed } = await bootProvider(['--socket', '/local/admin.sock', '--timeout', timeout, 'list'], 'remote-device')
    expect(observed.out).toContain('expected an integer from 1 to 2147483647')
    expect(observed.exits).toEqual([1])
  })

  it.each([
    { args: ['list'], message: 'supply exactly one of --socket and --bootstrap' },
    { args: ['--bootstrap', '--socket', '/local/admin.sock', 'list'], message: 'supply exactly one of --socket and --bootstrap' },
    { args: ['--socket', 'relative.sock', 'list'], message: 'requires an absolute socket path' },
    { args: ['--bootstrap', 'rotate', 'device-id'], message: '--bootstrap supports create and list' },
    { args: ['--bootstrap', 'revoke', 'device-id'], message: '--bootstrap supports create and list' },
  ])('rejects administrative arguments $args before startup', async ({ args, message }) => {
    const { values, observed } = await bootProvider(args, 'remote-device')
    expect(observed.out).toContain(message)
    expect(observed.exits).toEqual([1])
    expect(values).toBeUndefined()
    expect(observed.readerConfig).toBeUndefined()
  })

  it.each([
    { args: ['--url', 'https://host.example', 'list'], message: 'supply exactly one of --token-env and --token-stdin' },
    { args: ['--url', 'https://host.example', '--token-env', 'OCEAN_DEVICE_TEST_TOKEN', '--token-stdin', 'list'], message: 'supply exactly one of --token-env and --token-stdin' },
    { args: ['--url', 'http://host.example', '--token-stdin', 'list'], message: 'use an HTTPS URL without credentials, query, or fragment' },
    { args: ['--url', 'https://host.example/?token=secret', '--token-stdin', 'list'], message: 'use an HTTPS URL without credentials, query, or fragment' },
  ])('rejects remote client arguments $args before startup', async ({ args, message }) => {
    const { values, observed } = await bootProvider(args, 'connect')
    expect(observed.out).toContain(message)
    expect(observed.exits).toEqual([1])
    expect(values).toBeUndefined()
  })

  it('describes device-authenticated server startup without browser handoff', async () => {
    const { values, observed } = await bootProvider(['--help'], 'serve')
    expect(observed.out).toContain('Serve an Ocean Host with device authentication.')
    expect(observed.out).toContain('Non-loopback listeners require --tls-cert and --tls-key')
    expect(observed.out).toContain('ocean remote-device')
    expect(observed.out).not.toContain('--no-open')
    expect(observed.out).not.toContain('ocean --profile web')
    expect(values).toBeUndefined()
    expect(observed.exits).toEqual([0])
  })

  it('disables browser opening for a server invocation', async () => {
    const { values, observed } = await bootProvider([], 'serve')
    expect(values?.openBrowser).toBe(false)
    expect(observed.exits).toEqual([])
  })

  it('publishes the administrator socket named by a server invocation', async () => {
    const { values, observed } = await bootProvider(['--device-admin-socket', '/run/ocean/admin.sock'], 'serve')
    expect(values).toEqual({ openBrowser: false, trustedHosts: [], deviceAdminSocket: '/run/ocean/admin.sock' })
    expect(observed.exits).toEqual([])
  })

  /** A tailnet node named `bigpc` with HTTPS certificates, as `tailscale status --json` reports it. */
  function runningTailnet(): void {
    tailscale.run = () => ({
      status: 0, stderr: '',
      stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: 'bigpc.tail71ee4f.ts.net.' }, CertDomains: ['bigpc.tail71ee4f.ts.net'] }),
    })
  }

  it('publishes the tailnet name as the public URL and trusted host for --tailscale-serve', async () => {
    runningTailnet()
    const { values, observed } = await bootProvider(['--tailscale-serve', '--trusted-host', 'ocean.lan'], 'serve')
    expect(values).toEqual({
      openBrowser: false, publicUrl: 'https://bigpc.tail71ee4f.ts.net/', trustedHosts: ['ocean.lan', 'bigpc.tail71ee4f.ts.net'],
      tailscaleServePort: 443, tailscaleCommand: 'tailscale',
    })
    expect(observed.readerConfig).toMatchObject({ tailscaleServePort: 443, tailscaleCommand: 'tailscale' })
    expect(observed.exits).toEqual([])
  })

  it('runs the Tailscale executable named by --tailscale-command and publishes it for the mapping', async () => {
    const commands: string[] = []
    tailscale.run = (command) => {
      commands.push(command)
      return {
        status: 0, stderr: '',
        stdout: JSON.stringify({ BackendState: 'Running', Self: { DNSName: 'bigpc.tail71ee4f.ts.net.' }, CertDomains: ['bigpc.tail71ee4f.ts.net'] }),
      }
    }
    const { values } = await bootProvider(['--tailscale-serve', '--tailscale-command', '/usr/local/bin/tailscale-sudo'], 'serve')
    expect(commands).toEqual(['/usr/local/bin/tailscale-sudo'])
    expect(values).toMatchObject({ tailscaleCommand: '/usr/local/bin/tailscale-sudo' })
  })

  it('keeps a custom Tailscale HTTPS port in the advertised URL and accepts a loopback --host', async () => {
    runningTailnet()
    const { values } = await bootProvider(['--tailscale-serve', '--tailscale-serve-port', '8443', '--host', '127.0.0.1'], 'serve')
    expect(values).toMatchObject({ publicUrl: 'https://bigpc.tail71ee4f.ts.net:8443/', tailscaleServePort: 8443, host: '127.0.0.1' })
  })

  it.each([
    { args: ['--tailscale-serve-port', '8443'], message: '--tailscale-serve-port and --tailscale-command require --tailscale-serve' },
    { args: ['--tailscale-command', '/bin/tailscale'], message: '--tailscale-serve-port and --tailscale-command require --tailscale-serve' },
    { args: ['--tailscale-serve', '--public-url', 'https://x.example/'], message: 'remove --public-url, --tls-cert, and --tls-key' },
    { args: ['--tailscale-serve', '--tls-cert', 'c.pem', '--tls-key', 'k.pem'], message: 'remove --public-url, --tls-cert, and --tls-key' },
    { args: ['--tailscale-serve', '--host', '10.0.0.7'], message: 'keeps the listener on loopback' },
    { args: ['--tailscale-serve', '--tailscale-serve-port', 'abc'], message: '--tailscale-serve-port must be a port from 1 to 65535' },
    { args: ['--tailscale-serve', '--tailscale-serve-port', '0'], message: '--tailscale-serve-port must be a port from 1 to 65535' },
    { args: ['--tailscale-serve', '--tailscale-serve-port', '70000'], message: '--tailscale-serve-port must be a port from 1 to 65535' },
  ])('rejects $args before startup', async ({ args, message }) => {
    runningTailnet()
    const { values, observed } = await bootProvider(args, 'serve')
    expect(observed.out).toContain(message)
    expect(observed.exits).toEqual([1])
    expect(values).toBeUndefined()
  })

  it('reports an unusable tailnet as a usage error', async () => {
    tailscale.run = () => ({ status: null, stdout: '', stderr: '', error: new Error('spawn tailscale ENOENT') })
    const { values, observed } = await bootProvider(['--tailscale-serve'], 'serve')
    expect(observed.out).toContain('could not run "tailscale"')
    expect(observed.exits).toEqual([1])
    expect(values).toBeUndefined()
  })

  it('rejects the Tailscale flags outside the server profile', async () => {
    runningTailnet()
    const web = await bootProvider(['--tailscale-serve'])
    expect(web.observed.out).toContain("unknown option '--tailscale-serve'")
    expect(web.observed.exits).toEqual([1])
  })

  it('rejects browser-only options in a server invocation', async () => {
    const { values, observed } = await bootProvider(['--no-open'], 'serve')
    expect(observed.out).toContain("unknown option '--no-open'")
    expect(values).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })

  it('publishes each flag and releases direct service expressions', async () => {
    const { values, observed } = await bootProvider([
      '--host', '127.0.0.1',
      '--no-open',
      '--port', '8080',
      '--trusted-host', 'lab.internal', 'lab-2.internal',
      '--trusted-host', '10.0.0.9',
      '--tls-cert', 'fullchain.pem',
      '--tls-key', 'private-key.pem',
    ])
    expect(values).toEqual({
      host: '127.0.0.1',
      openBrowser: false,
      port: 8080,
      trustedHosts: ['lab.internal', 'lab-2.internal', '10.0.0.9'],
      tls: { certFile: 'fullchain.pem', keyFile: 'private-key.pem' },
    })
    expect(observed.readerConfig).toEqual(values)
    expect(observed.exits).toEqual([])
  })

  // The webserver suite owns the wildcard spellings; the CLI only has to
  // refuse them by address value before any consumer activates.
  it.each(['0.0.0.0', '::ffff:0.0.0.0'])('rejects wildcard --host %s before activating consumers', async (host) => {
    const { values, observed } = await bootProvider(['--host', host])
    expect(observed.out).toContain(`error: --host ${host} is an unspecified (wildcard) address`)
    expect(values).toBeUndefined()
    expect(observed.readerConfig).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })

  it('leaves deployment values to each consumer when flags omit them', async () => {
    const { values, observed } = await bootProvider([])
    expect(values).toEqual({ openBrowser: true, trustedHosts: [] })
    expect(observed.readerConfig).toEqual({
      host: '127.0.0.1',
      openBrowser: true,
      port: 3080,
      trustedHosts: [],
    })
  })

  it('prints its own help and leaves the consumer pending', async () => {
    const { values, observed } = await bootProvider(['--help'])
    expect(observed.out).toContain('ocean --profile web')
    expect(observed.out).toContain('--no-open')
    expect(observed.out).toContain('--public-url')
    expect(observed.out).toContain('--trusted-host')
    expect(values).toBeUndefined()
    expect(observed.readerConfig).toBeUndefined()
    expect(observed.exits).toEqual([0])
  })

  it('rejects a non-numeric port before the consumer activates', async () => {
    const { values, observed } = await bootProvider(['--port', 'abc'])
    expect(observed.out).toContain('--port must be a number')
    expect(values).toBeUndefined()
    expect(observed.readerConfig).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })

  it('publishes --public-url as advertisement only, leaving the fence to --trusted-host', async () => {
    const { values, observed } = await bootProvider([
      '--public-url', 'https://web.example/ui',
      '--trusted-host', 'lab.internal',
    ])
    expect(values).toEqual({
      openBrowser: true,
      publicUrl: 'https://web.example/ui',
      trustedHosts: ['lab.internal'],
    })
    expect(observed.readerConfig).toEqual({
      host: '127.0.0.1',
      openBrowser: true,
      port: 3080,
      publicUrl: 'https://web.example/ui',
      trustedHosts: ['lab.internal'],
    })
    expect(observed.exits).toEqual([])
  })

  it.each(['--tls-cert', '--tls-key'])('rejects an unpaired %s before activating consumers', async (flag) => {
    const { values, observed } = await bootProvider([flag, 'server.pem'])
    expect(observed.out).toContain('--tls-cert and --tls-key must be supplied together')
    expect(values).toBeUndefined()
    expect(observed.readerConfig).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })

  it('rejects a malformed --public-url before the consumer activates', async () => {
    // The parser's own suite owns the exhaustive spellings; the provider only
    // has to fail the invocation before any consumer activates.
    const { values, observed } = await bootProvider(['--public-url', '/web/ui'])
    expect(observed.out).toContain('error: --public-url must be an absolute http or https URL of the form http(s)://host[/prefix]')
    expect(values).toBeUndefined()
    expect(observed.readerConfig).toBeUndefined()
    expect(observed.exits).toEqual([1])
  })
})
