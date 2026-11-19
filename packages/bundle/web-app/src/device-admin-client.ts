/** Local credential bootstrap and CLI transport for a Host's administrator socket. */
import { request } from 'node:http'
import { isAbsolute } from 'node:path'
import { Command, InvalidArgumentError } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { parseCmdline } from '@ocean/ocean-cmdline'

type Operation =
  | { action: 'list' }
  | { action: 'create'; label: string }
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
  const run = (operation: Operation): void => {
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
          const result = operation.action === 'create' ? scope.deviceBootstrap.issue(operation.label) : scope.deviceBootstrap.list()
          void result.then((value) => { console.log(JSON.stringify(value)); exit(0) }, failure)
        }), 'remote-device: local bootstrap')
      })
    } else {
      ctx.effect(() => ready.onReady(() => {
        void send(socket, operation, timeout).then((result) => {
          if (result.ok) { console.log(result.value); exit(0); return }
          console.error(result.committed && result.cleanupFailed
            ? 'ocean remote-device: the access change was saved, but live connection cleanup failed. Inspect the Host before retrying.'
            : 'ocean remote-device: operation outcome is unknown. Inspect device state before retrying.')
          exit(1)
        }, failure)
      }), 'remote-device: run local command')
    }
  }
  program.command('list').description('List devices and their access state').action(() => { run({ action: 'list' }) })
  program.command('create').description('Create a device and return its token once').argument('<label>')
    .action((label: string) => { run({ action: 'create', label }) })
  program.command('rotate').description('Replace a device token and invalidate its existing logins').argument('<id>')
    .action((id: string) => { run({ action: 'rotate', id }) })
  program.command('revoke').description('Revoke a device and close its live connections').argument('<id>')
    .action((id: string) => { run({ action: 'revoke', id }) })
  parseCmdline(ctx, program)
}
