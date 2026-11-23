/** Local credential bootstrap and CLI transport for a Host's administrator socket. */
import { request } from 'node:http'
import { isAbsolute } from 'node:path'
import { Command, InvalidArgumentError } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@ocean/ocean-cmdline'
import { DEVICE_SCOPES, parseDeviceScopes, type DeviceScope } from '@ocean/ocean-client-connection/device'

type Operation =
  | { action: 'list' }
  | { action: 'create'; label: string; scopes?: DeviceScope[] }
  | { action: 'pair'; label: string; ttlSeconds?: number; scopes?: DeviceScope[] }
  | { action: 'rotate' | 'revoke'; id: string }

type AdminReply = { ok: true; value: string } | { ok: false; committed: boolean; cleanupFailed: boolean }

function send(socketPath: string, operation: Operation, timeoutMs: number): Promise<AdminReply> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(operation)
    const req = request({
      socketPath,
      path: '/',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) },
      signal: AbortSignal.timeout(timeoutMs),
    }, (res) => {
      void (async () => {
        const chunks: Buffer[] = []
        let length = 0
        for await (const chunk of res) {
          /* v8 ignore next -- node:http without setEncoding yields only Buffer chunks on this transport */
          if (!Buffer.isBuffer(chunk)) throw new Error('invalid administrative response')
          length += chunk.length
          if (length > 1024 * 1024) throw new Error('administrative response exceeds its size limit')
          chunks.push(chunk)
        }
        const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        if (res.statusCode !== 200) {
          const error = typeof data === 'object' && data !== null && 'error' in data ? data.error : undefined
          resolve({ ok: false,
            committed: typeof error === 'object' && error !== null && 'durableOutcome' in error && error.durableOutcome === 'committed',
            cleanupFailed: typeof error === 'object' && error !== null && 'liveCleanup' in error && error.liveCleanup === 'failed',
          })
          return
        }
        if (typeof data !== 'object' || data === null || !('result' in data)) throw new Error('invalid administrative response')
        if (data.result === null || data.result === false) throw new Error('device is absent or inactive')
        resolve({ ok: true, value: JSON.stringify(data.result) })
      })().catch((error: unknown) => {
        reject(error instanceof Error ? error :
          /* v8 ignore next -- node:http rejects the response iterator only with Error values */
          new Error('administrative response failed'))
      })
    })
    req.once('error', reject)
    req.end(payload)
  })
}

/**
 * Build the link a new device opens to pair with this Host.
 * @param address - HTTPS address clients use to reach the Host.
 * @param label - Name the new device receives.
 * @param grant - One-time grant bearer returned by the Host.
 * @returns An `ocean://pair` link that keeps the grant in its fragment.
 */
export function pairingLink(address: string, label: string, grant: string): string {
  const url = new URL('ocean://pair')
  url.searchParams.set('host', address)
  url.searchParams.set('label', label)
  url.hash = grant
  return url.href
}

/**
 * Run one administrative command after the launcher commits startup.
 * @param ctx - Profile context carrying launcher arguments and exit lifecycle.
 */
export function runDeviceAdmin(ctx: Context): void {
  const program = new Command().name('ocean remote-device')
    .description('Manage device access through a Host’s local socket, or bootstrap its local credential store.')
    .option('--socket <path>', 'absolute path to the running Host administrator socket')
    .option('--bootstrap', 'create or list devices using the local credential store; supports Windows')
    .option('--timeout <milliseconds>', 'maximum time to wait for a socket operation and live connection cleanup', (value) => {
      const parsed = Number(value)
      if (!/^\d+$/u.test(value) || !Number.isSafeInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) {
        throw new InvalidArgumentError('expected an integer from 1 to 2147483647')
      }
      return parsed
    }, 30_000)
  const run = (operation: Operation, format: (value: string) => string = value => value): void => {
    const { socket, timeout, bootstrap } = program.opts<{ socket?: string; timeout: number; bootstrap?: boolean }>()
    if ((socket !== undefined) === (bootstrap === true)) program.error('supply exactly one of --socket and --bootstrap')
    if (socket !== undefined && !isAbsolute(socket)) program.error('device administration requires an absolute socket path')
    if (bootstrap && operation.action !== 'create' && operation.action !== 'list') {
      program.error('--bootstrap supports create and list; rotate and revoke require a running Host administrator socket')
    }
    const ready = ctx.get('appReady')
    const exit = ctx.get('appExit')
    if (ready === undefined || exit === undefined) throw new Error('device administration requires the profile launcher')
    const failure = (): void => {
      console.error(socket === undefined
        ? 'ocean remote-device: command failed. Verify access to the Host credential store, then list devices before retrying.'
        : 'ocean remote-device: command failed. Verify the Host and socket path, then inspect device state before retrying.')
      exit(1)
    }
    if (socket === undefined) {
      ctx.inject(['deviceBootstrap'], (scope) => {
        scope.effect(() => ready.onReady(() => {
          const result = operation.action === 'create'
            ? scope.deviceBootstrap.issue(operation.label, operation.scopes)
            : scope.deviceBootstrap.list()
          void result.then((value) => { console.log(JSON.stringify(value)); exit(0) }, failure)
        }), 'remote-device: local bootstrap')
      })
    } else {
      ctx.effect(() => ready.onReady(() => {
        void send(socket, operation, timeout).then((result) => {
          if (result.ok) {
            let output: string
            try { output = format(result.value) } catch (error) {
              console.error(`ocean remote-device: ${(error as Error).message}`)
              exit(1)
              return
            }
            console.log(output)
            exit(0)
            return
          }
          console.error(result.committed && result.cleanupFailed
            ? 'ocean remote-device: the access change was saved, but live connection cleanup failed. Inspect the Host before retrying.'
            : 'ocean remote-device: operation outcome is unknown. Inspect device state before retrying.')
          exit(1)
        }, failure)
      }), 'remote-device: run local command')
    }
  }
  program.command('list').description('List devices and their access state').action(() => { run({ action: 'list' }) })
  const scopeOption = (): [string, string, (value: string, previous: string[]) => string[], string[]] => [
    '--scope <name>', `a right the device holds; repeat to name several (${DEVICE_SCOPES.join(', ')}); every right when absent`,
    (value, previous) => [...previous, value], [],
  ]
  const readScopes = (names: string[]): { scopes?: DeviceScope[] } => {
    if (names.length === 0) return {}
    try { return { scopes: parseDeviceScopes(names) } } catch (error) { return program.error((error as Error).message) }
  }
  program.command('create').description('Create a device and return its token once').argument('<label>')
    .option(...scopeOption())
    .action((label: string, options: { scope: string[] }) => { run({ action: 'create', label, ...readScopes(options.scope) }) })
  program.command('pair').description('Create a one-time link that adds a device without typing its token')
    .argument('<label>')
    .option('--url <https-url>', 'HTTPS address clients use to reach this Host, including any mount path; the Host supplies its public URL when it has one')
    .option(...scopeOption())
    .option('--ttl <seconds>', 'how long the link stays valid, 30 to 3600; the Host default applies otherwise', (value) => {
      const parsed = Number(value)
      if (!/^\d+$/u.test(value) || parsed < 30 || parsed > 3_600) throw new InvalidArgumentError('expected an integer from 30 to 3600')
      return parsed
    })
    .action((label: string, options: { url?: string; ttl?: number; scope: string[] }) => {
      let address: URL | undefined
      if (options.url !== undefined) {
        try { address = new URL(options.url) } catch { program.error('--url must be a valid HTTPS address'); return }
        if (address.protocol !== 'https:' || address.username || address.password || address.search || address.hash) {
          program.error('--url must be an HTTPS address without credentials, a query, or a fragment')
        }
      }
      run({ action: 'pair', label, ...options.ttl === undefined ? {} : { ttlSeconds: options.ttl }, ...readScopes(options.scope) }, (value) => {
        const reply = JSON.parse(value) as { grant: string; expiresAt: number; address?: string }
        const target = address?.href ?? reply.address
        if (target === undefined) throw new Error('pass --url: this Host does not advertise an HTTPS address')
        return JSON.stringify({
          link: pairingLink(target, label, reply.grant),
          expiresAt: new Date(reply.expiresAt).toISOString(),
        })
      })
    })
  program.command('rotate').description('Replace a device token and invalidate its existing logins').argument('<id>')
    .action((id: string) => { run({ action: 'rotate', id }) })
  program.command('revoke').description('Revoke a device and close its live connections').argument('<id>')
    .action((id: string) => { run({ action: 'revoke', id }) })
  parseCmdline(ctx, program)
}
