/**
 * Tailscale HTTPS for `ocean serve --tailscale-serve`: reads this node's tailnet name and publishes
 * the loopback listener through `tailscale serve`, so Tailscale terminates TLS with its own certificate.
 * @module @ocean/ocean-web-app/tailscale
 */

import { spawnSync } from 'node:child_process'
import { HarnessError } from '@ocean/ocean-error'

/** Outcome of one `tailscale` invocation. */
export interface TailscaleRun {
  /** Exit status, or null when the process never started or was killed. */
  readonly status: number | null
  /** Standard output decoded as UTF-8. */
  readonly stdout: string
  /** Standard error decoded as UTF-8. */
  readonly stderr: string
  /** Why the process could not run, such as a missing binary. */
  readonly error?: Error
}

/** Test hook for the Tailscale command; production runs the named executable. */
export const tailscale: { run: (command: string, args: readonly string[]) => TailscaleRun } = {
  run(command, args) {
    const result = spawnSync(command, [...args], { encoding: 'utf8', timeout: 15_000 })
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      ...result.error === undefined ? {} : { error: result.error },
    }
  },
}

/** Tailscale cannot publish this Host; the message names what to change. */
export class TailscaleServeError extends HarnessError {
  /**
   * @param message - Actionable explanation without command output beyond its first line.
   * @param options - Standard error options carrying the underlying failure.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'TAILSCALE_SERVE_UNAVAILABLE', options)
  }
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/u, 1).join('')
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

/**
 * Read this node's HTTPS name on the tailnet.
 * @param command - Tailscale executable, such as `tailscale` or a wrapper that runs it with privileges.
 * @returns The fully qualified MagicDNS name without its trailing dot.
 * @throws {TailscaleServeError} When Tailscale is missing, stopped, or has no HTTPS certificate for this node.
 */
export function resolveTailscaleHost(command: string): string {
  const run = tailscale.run(command, ['status', '--json'])
  if (run.error !== undefined) {
    throw new TailscaleServeError(`--tailscale-serve could not run ${JSON.stringify(command)}; install Tailscale and sign in, or name the executable with --tailscale-command`)
  }
  if (run.status !== 0) {
    throw new TailscaleServeError(`--tailscale-serve could not read the Tailscale status: ${firstLine(run.stderr) || `exit ${String(run.status)}`}`)
  }
  let status: unknown
  try { status = JSON.parse(run.stdout) } catch (cause) {
    throw new TailscaleServeError('--tailscale-serve could not read the Tailscale status: the command did not return JSON', { cause })
  }
  const record = asRecord(status)
  if (record.BackendState !== 'Running') {
    throw new TailscaleServeError('--tailscale-serve needs Tailscale to be running; run `tailscale up` first')
  }
  const self = asRecord(record.Self)
  const dnsName = typeof self.DNSName === 'string' ? self.DNSName.replace(/\.$/u, '') : ''
  const domains = Array.isArray(record.CertDomains) ? record.CertDomains : []
  if (dnsName === '') {
    throw new TailscaleServeError('--tailscale-serve needs MagicDNS; enable it for the tailnet')
  }
  if (!domains.includes(dnsName)) {
    throw new TailscaleServeError('--tailscale-serve needs HTTPS certificates; enable them for the tailnet and try again')
  }
  return dnsName
}

/**
 * Build the HTTPS root Tailscale serves for this node.
 * @param dnsName - MagicDNS name from {@link resolveTailscaleHost}.
 * @param httpsPort - Tailscale HTTPS port; 443 is the default and leaves the URL without a port.
 * @returns The HTTPS root ending in a slash.
 */
export function tailscaleOrigin(dnsName: string, httpsPort: number): string {
  return `https://${dnsName}${httpsPort === 443 ? '' : `:${String(httpsPort)}`}/`
}

/**
 * Refuse a port that another Tailscale mapping already uses, so publishing never replaces an existing site or forward.
 * A mapping that already forwards `/` to this listener is the same publication and is accepted.
 * @param command - Tailscale executable.
 * @param httpsPort - Tailscale HTTPS port about to be claimed.
 * @param target - Loopback URL this Host forwards to.
 * @throws {TailscaleServeError} When the port is taken, or the current serve configuration cannot be read.
 */
function assertPortAvailable(command: string, httpsPort: number, target: string): void {
  const run = tailscale.run(command, ['serve', 'status', '--json'])
  if (run.error !== undefined || run.status !== 0) {
    const reason = firstLine(run.stderr) || run.error?.message || `exit ${String(run.status)}`
    throw new TailscaleServeError(`--tailscale-serve could not read the existing serve configuration: ${reason}`)
  }
  let parsed: unknown
  try { parsed = JSON.parse(run.stdout.trim() === '' ? '{}' : run.stdout) } catch (cause) {
    throw new TailscaleServeError(
      '--tailscale-serve could not read the existing serve configuration: the command did not return JSON', { cause })
  }
  const config = asRecord(parsed)
  const web = asRecord(config.Web)
  const sites = Object.entries(web)
    .filter(([authority]) => authority.endsWith(`:${String(httpsPort)}`))
    .map(([, site]) => asRecord(asRecord(site).Handlers))
  const forwarded = Object.hasOwn(asRecord(config.TCP), String(httpsPort))
  const [only] = sites
  const ours = sites.length === 1 && only !== undefined && Object.keys(only).length === 1 && asRecord(only['/']).Proxy === target
  if ((sites.length > 0 || forwarded) && !ours) {
    throw new TailscaleServeError(`--tailscale-serve found port ${String(httpsPort)} already used by another Tailscale mapping; `
      + `choose a free port with --tailscale-serve-port, or free it with \`tailscale serve --https=${String(httpsPort)} off\``)
  }
}

/**
 * Publish a loopback listener on the tailnet over HTTPS.
 * @param command - Tailscale executable.
 * @param httpsPort - Tailscale HTTPS port to claim.
 * @param localPort - Port of the loopback listener that receives the forwarded requests.
 * @returns A function that removes the mapping; it reports a failure instead of throwing, since shutdown cannot recover.
 * @throws {TailscaleServeError} When the port already serves something else, or Tailscale refuses the mapping,
 *   for example without permission to configure serve.
 */
export function startTailscaleServe(command: string, httpsPort: number, localPort: number): () => string | undefined {
  const target = `http://127.0.0.1:${String(localPort)}`
  assertPortAvailable(command, httpsPort, target)
  const run = tailscale.run(command, ['serve', '--bg', `--https=${String(httpsPort)}`, target])
  if (run.error !== undefined || run.status !== 0) {
    const reason = firstLine(run.stderr) || run.error?.message || `exit ${String(run.status)}`
    throw new TailscaleServeError(`--tailscale-serve could not publish port ${String(httpsPort)}: ${reason}`)
  }
  return () => {
    const removal = tailscale.run(command, ['serve', `--https=${String(httpsPort)}`, 'off'])
    if (removal.error === undefined && removal.status === 0) return undefined
    return `could not remove the Tailscale serve mapping on port ${String(httpsPort)}; run \`tailscale serve --https=${String(httpsPort)} off\``
  }
}
