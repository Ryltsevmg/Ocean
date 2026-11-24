/**
 * The web app's command-line provider: it parses the `ocean --profile web` flag
 * family (`--host`, `--port`, `--public-url`, `--trusted-host`, `--no-open`, TLS)
 * and its `--help` text, then provides the immutable values as
 * {@link WEB_STARTUP_SERVICE}. Ordinary rows inject that service before
 * reading it from lazy config.
 * @module @ocean/ocean-web-app/startup
 */

import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@ocean/ocean-cmdline'
import { isLoopbackHost, isWildcardHost, type TlsConfig } from '@ocean/ocean-host-webserver'
import { runDeviceConnect } from './device-connect-client.ts'
import { runDeviceAdmin } from './device-admin-client.ts'
import { parsePublicUrl } from './public-url.ts'
import { resolveTailscaleHost, tailscaleOrigin } from './tailscale.ts'

/** Stable Cordis plugin name. */
export const name = 'web-startup'

/** Services required before the flags can be resolved. */
export const inject = ['cmdlineArgs']

/** Service provided by this ordinary plugin and injected by flag-configured rows. */
export const WEB_STARTUP_SERVICE = 'webStartup'

/** What the web rows read from {@link WEB_STARTUP_SERVICE}. */
export interface WebStartupValues {
  /** Whether this invocation opens the default browser after startup. */
  openBrowser: boolean
  /** `--host`, absent when the invocation did not name one. */
  host?: string
  /** `--port`, absent when the invocation did not name one. */
  port?: number
  /**
   * `--public-url`, absent when not specified: the advertised HTTP(S) root.
   * See [public deployments](../README.md#public-deployments).
   */
  publicUrl?: string
  /** Explicit `--trusted-host` authorities, in argument order. */
  trustedHosts: string[]
  /** Server certificate chain and unencrypted private key supplied together. */
  tls?: TlsConfig
  /** Owner-only administrator socket for the server profile. */
  deviceAdminSocket?: string
  /** Tailscale HTTPS port that publishes the loopback listener, when `--tailscale-serve` was passed. */
  tailscaleServePort?: number
  /** Tailscale executable used with `--tailscale-serve`; `tailscale` unless `--tailscale-command` named another. */
  tailscaleCommand?: string
}

/** The web flag family, as commander parsed it. */
interface WebOptions {
  host?: string
  open?: boolean
  port?: string
  publicUrl?: string
  trustedHost?: string[]
  tlsCert?: string
  tlsKey?: string
  deviceAdminSocket?: string
  tailscaleServe?: boolean
  tailscaleServePort?: string
  tailscaleCommand?: string
}

/**
 * This app's command: its flags, its description, and its help text.
 * @param serverMode - Whether this is the device-authenticated server profile.
 * @returns a fresh program, so one process can parse more than once (tests).
 */
function webCommand(serverMode: boolean): Command {
  const program = new Command()
    .name(serverMode ? 'ocean serve' : 'ocean --profile web')
    .description(serverMode ? 'Serve an Ocean Host with device authentication.' : 'Serve the Ocean browser UI.')
    .helpOption('-h, --help', 'show this help')
    .option('--host <host>', 'bind address: one concrete IPv4 or IPv6 literal of a local interface; wildcard addresses are rejected')
    .option('--port <port>', 'listen port; pass 0 to let the OS pick a free one')
    .option('--public-url <url>', 'advertise this HTTP(S) root in the printed, opened, runtime-context, and OCEAN_WEB_URL forms; grants no trust')
    .option('--trusted-host <authority...>', 'extra authority the /api browser-trust fence accepts (host or host:port; repeatable)')
    .option('--tls-cert <file>', 'PEM server certificate chain; requires --tls-key')
    .option('--tls-key <file>', 'unencrypted PEM private key; requires --tls-cert')
  if (serverMode) {
    program.option('--device-admin-socket <path>', 'owner-only local administrator socket')
      .option('--tailscale-serve', 'publish the loopback listener on this node\'s tailnet name over HTTPS through `tailscale serve`; replaces --public-url and TLS')
      .option('--tailscale-serve-port <port>', 'Tailscale HTTPS port for --tailscale-serve; default 443')
      .option('--tailscale-command <path>', 'Tailscale executable for --tailscale-serve, such as a wrapper that runs it with sudo; default tailscale')
      .addHelpText('after', `
Examples:
  ocean serve --host 127.0.0.1 --port 3080
                                             serve on loopback without opening a browser
  ocean serve --host 10.0.0.7 --tls-cert ./server-chain.pem --tls-key ./server-key.pem
                                             serve HTTPS on one local interface
  ocean serve --tailscale-serve --device-admin-socket /absolute/path/admin.sock
                                             serve on loopback and publish https://<node>.<tailnet>.ts.net/
  ocean remote-device --socket /absolute/path/admin.sock create laptop
                                             create a device token through the local administrator socket
  ocean remote-device --socket /absolute/path/admin.sock pair laptop
                                             create a one-time link that adds a device

Non-loopback listeners require --tls-cert and --tls-key, or --tailscale-serve on loopback.
Use the local administrator socket to create device tokens; the server URL contains no
launch token.
`)
  } else {
    program.option('--no-open', 'do not open the Web UI in the default browser')
      .addHelpText('after', `
Examples:
  ocean --profile web                          serve on the composed host and port
  ocean --profile web --no-open                serve without opening a browser
  ocean --profile web --port 8080              serve on another port
  ocean --profile web --host 10.0.0.7          bind one local interface address
  ocean --profile web --public-url https://app.example/ui/ --trusted-host app.example
                                             advertise a prefix-stripping HTTPS proxy entry and admit its authority
  ocean --profile web --tls-cert ./server-chain.pem --tls-key ./server-key.pem
                                             serve HTTPS with an existing certificate and key
`)
  }
  return program
}

/**
 * Validate `--tailscale-serve` and read this node's tailnet name. Only the server profile declares the flags.
 * @param program - The command, whose `error` reports a usage error.
 * @param options - Parsed flags.
 * @returns The tailnet name, the advertised HTTPS root, the Tailscale HTTPS port, and the executable; undefined without the flag.
 */
function resolveTailscaleOptions(
  program: Command, options: WebOptions,
): { dnsName: string; publicUrl: string; httpsPort: number; command: string } | undefined {
  if (options.tailscaleServe !== true) {
    if (options.tailscaleServePort !== undefined || options.tailscaleCommand !== undefined) {
      program.error('error: --tailscale-serve-port and --tailscale-command require --tailscale-serve')
    }
    return undefined
  }
  if (options.publicUrl !== undefined || options.tlsCert !== undefined) {
    program.error('error: --tailscale-serve supplies the public URL and TLS; remove --public-url, --tls-cert, and --tls-key')
  }
  if (options.host !== undefined && !isLoopbackHost(options.host)) {
    program.error('error: --tailscale-serve keeps the listener on loopback; remove --host or name a loopback address')
  }
  const rawPort = options.tailscaleServePort ?? '443'
  const httpsPort = Number(rawPort)
  if (!/^\d+$/u.test(rawPort) || httpsPort < 1 || httpsPort > 65_535) {
    program.error(`error: --tailscale-serve-port must be a port from 1 to 65535, got ${JSON.stringify(rawPort)}`)
  }
  try {
    const command = options.tailscaleCommand ?? 'tailscale'
    const dnsName = resolveTailscaleHost(command)
    return { dnsName, publicUrl: tailscaleOrigin(dnsName, httpsPort), httpsPort, command }
  } catch (error) {
    return program.error(`error: ${(error as Error).message}`)
  }
}

/**
 * Parse and provide the Web invocation as an ordinary Cordis service. The
 * command's action publishes the flags this invocation named. Invalid flags,
 * including an unpaired TLS certificate or key, are usage errors; rejection
 * and `--help` provide no service.
 * @param ctx - plugin context carrying the command line.
 */
export function apply(ctx: Context): void {
  const profile = ctx.get('profileContext')?.name
  if (profile === 'connect') {
    runDeviceConnect(ctx)
    return
  }
  if (profile === 'remote-device') {
    runDeviceAdmin(ctx)
    return
  }
  const program = webCommand(profile === 'serve')
  program.action(() => {
    const options = program.opts<WebOptions>()
    if (options.host !== undefined && isWildcardHost(options.host)) {
      program.error(`error: --host ${options.host} is an unspecified (wildcard) address, which is not supported: binding every interface would expose remote code execution to the network; bind one concrete IPv4 or IPv6 address instead`)
    }
    if (options.port !== undefined && !/^\d+$/.test(options.port)) {
      program.error(`error: --port must be a number, got ${JSON.stringify(options.port)}`)
    }
    let tls: TlsConfig | undefined
    if (options.tlsCert !== undefined && options.tlsKey !== undefined) {
      tls = { certFile: options.tlsCert, keyFile: options.tlsKey }
    } else if (options.tlsCert !== undefined || options.tlsKey !== undefined) {
      program.error('error: --tls-cert and --tls-key must be supplied together')
    }
    if (options.publicUrl !== undefined) {
      try {
        parsePublicUrl(options.publicUrl, '--public-url')
      } catch (error) {
        program.error(`error: ${(error as Error).message}`)
      }
    }
    const tailscale = resolveTailscaleOptions(program, options)
    const publicUrl = tailscale?.publicUrl ?? options.publicUrl
    ctx.provide(WEB_STARTUP_SERVICE, {
      openBrowser: profile !== 'serve' && options.open === true,
      ...options.host !== undefined && { host: options.host },
      ...options.port !== undefined && { port: Number(options.port) },
      ...publicUrl !== undefined && { publicUrl },
      ...tls !== undefined && { tls },
      trustedHosts: [...options.trustedHost ?? [], ...tailscale === undefined ? [] : [tailscale.dnsName]],
      ...tailscale !== undefined && { tailscaleServePort: tailscale.httpsPort, tailscaleCommand: tailscale.command },
      ...options.deviceAdminSocket !== undefined && { deviceAdminSocket: options.deviceAdminSocket },
    } satisfies WebStartupValues)
  })
  parseCmdline(ctx, program)
}
