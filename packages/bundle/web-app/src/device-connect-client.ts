/** CLI commands for the authenticated remote Ocean Host. */
import { randomUUID } from 'node:crypto'
import { openAsBlob } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { addAbortSignal } from 'node:stream'
import { Command } from 'commander'
import type { Context } from '@deepseek-ai/cordis'
import { serverResponseSchema } from '@ocean/ocean-client-connection'
import { DeviceClient, DeviceClientError, DeviceSessionRejectedError, DeviceSessionUnavailableError, parsePairing, type HostEpoch } from '@ocean/ocean-client-connection/device'
import { FILE_UPLOAD_ROUTE } from '@ocean/ocean-client-file-upload/protocol'
import { openDeviceStreamSocket, ClientUplinkQueue, RemoteStreamCarrierError, RemoteStreamMuxClient } from '@ocean/ocean-api-gateway/device'
import { parseCmdline } from '@ocean/ocean-cmdline'

interface CommandCall {
  endpoint: string
  args: Record<string, unknown>
  mutation?: boolean
  requestId?: string
  stream?: boolean
  terminalInput?: string
  upload?: { sessionId: string; path: string }
}

type CommandResult = { ok: true; value: unknown } | { ok: false; error: string }

function safeErrorCode(code: unknown): string {
  return typeof code === 'string' && /^[a-z0-9/_-]{1,100}$/iu.test(code) ? code : 'unknown'
}

function continuedQuestions(value: unknown): readonly unknown[] {
  if (value === null) return []
  if (typeof value !== 'object' || !('kind' in value) || value.kind !== 'sequenced'
    || !('values' in value) || typeof value.values !== 'object' || value.values === null) {
    throw new Error('Host did not return a current question projection')
  }
  if (!('userQuestions' in value.values)) return []
  const questions = value.values.userQuestions
  if (typeof questions !== 'object' || questions === null || !('active' in questions) || !Array.isArray(questions.active)) {
    throw new Error('invalid question projection')
  }
  const active: readonly unknown[] = questions.active
  return active.filter(row => typeof row === 'object' && row !== null && 'state' in row && row.state === 'continued')
}

async function readDeviceToken(signal: AbortSignal): Promise<string> {
  let input = ''
  for await (const chunk of addAbortSignal(signal, process.stdin.setEncoding('utf8'))) {
    if (typeof chunk !== 'string' || input.length + chunk.length > 256) {
      throw new Error('Invalid token input')
    }
    input += chunk
  }
  return input.trim()
}

async function invoke(client: DeviceClient, call: CommandCall, signal: AbortSignal): Promise<CommandResult> {
  const rpcId = randomUUID()
  const response = await client.request(call.endpoint, JSON.stringify({
    type: 'client-request', method: call.endpoint, rpcId, payload: { args: call.args },
  }), signal)
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('Host returned an unsuccessful HTTP status')
  }
  const decoded = serverResponseSchema.safeParse(await response.json())
  if (!decoded.success || decoded.data.rpcId !== rpcId) throw new Error('invalid remote response')
  if (!decoded.data.result.ok) {
    return { ok: false, error: safeErrorCode(decoded.data.result.error.code) }
  }
  const value: unknown = decoded.data.result.value
  if (call.endpoint === 'session/projections') return { ok: true, value: continuedQuestions(value) }
  if (call.endpoint === 'userQuestions/answer') {
    if (typeof value !== 'boolean') throw new Error('invalid question response')
    return { ok: true, value: { accepted: value } }
  }
  return { ok: true, value }
}

async function uploadFile(
  client: DeviceClient,
  upload: NonNullable<CommandCall['upload']>,
  signal: AbortSignal,
  onSubmit: () => void,
): Promise<CommandResult> {
  let body: Blob
  try {
    if (!(await stat(upload.path)).isFile()) return { ok: false, error: 'local/not-a-file' }
    body = await openAsBlob(upload.path, { type: 'application/octet-stream' })
  } catch (_error) {
    return { ok: false, error: 'local/file-unavailable' }
  }
  signal.throwIfAborted()
  const { address, cookie } = client.transportCredentials()
  const url = new URL(FILE_UPLOAD_ROUTE, address)
  url.searchParams.set('sessionId', upload.sessionId)
  url.searchParams.set('name', basename(upload.path))
  onSubmit()
  const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { cookie }, body, signal })
  if (!response.ok) {
    await response.body?.cancel()
    if (response.status >= 500) throw new Error('upload result unavailable')
    return { ok: false, error: `http/${response.status}` }
  }
  const result: unknown = await response.json()
  if (typeof result === 'object' && result !== null && 'ok' in result) {
    if (result.ok === true && 'value' in result && typeof result.value === 'object' && result.value !== null
      && 'receiptId' in result.value && typeof result.value.receiptId === 'string') {
      return { ok: true, value: result.value }
    }
    if (result.ok === false && 'error' in result && typeof result.error === 'object' && result.error !== null
      && 'code' in result.error) return { ok: false, error: safeErrorCode(result.error.code) }
  }
  throw new Error('invalid upload response')
}

async function observeStream(client: DeviceClient, call: CommandCall, epoch: HostEpoch, signal: AbortSignal): Promise<void> {
  let failures = 0
  while (true) {
    signal.throwIfAborted()
    const mux = new RemoteStreamMuxClient(path => client.openSocket(path, openDeviceStreamSocket))
    mux.start()
    try {
      for await (const frame of mux.open(call.endpoint, { args: call.args }, signal)) {
        if (frame !== null && typeof frame === 'object' && 'type' in frame && frame.type === 'snapshot') {
          failures = 0
        }
        console.log(JSON.stringify(frame))
      }
      return
    } catch (error) {
      if (!(error instanceof RemoteStreamCarrierError) || signal.aborted) throw error
    } finally {
      await mux.close()
    }

    console.error('ocean connect: stream interrupted. Waiting for a fresh snapshot.')
    while (true) {
      if (++failures > 5) throw new Error('stream reconnect attempts exhausted')
      await delay(Math.min(250 * 2 ** (failures - 1), 4_000) * (0.5 + Math.random() / 2), undefined, { signal })
      try {
        const checkSignal = AbortSignal.any([signal, AbortSignal.timeout(5_000)])
        const host = await client.identify(checkSignal)
        if (host.epoch !== epoch && call.endpoint === 'terminal/attach') {
          console.error('ocean connect: Host restarted. List its terminals before attaching again.')
          throw new Error('terminal Host epoch changed')
        }
        break
      } catch (error) {
        if (!(error instanceof DeviceSessionUnavailableError || error instanceof TypeError
          || (error instanceof DeviceClientError && error.code === 'DEVICE_CONNECTION_FAILED')
          || (error instanceof Error && error.name === 'TimeoutError'))) throw error
        signal.throwIfAborted()
      }
    }
  }
}

async function writeTerminal(
  client: DeviceClient,
  call: CommandCall,
  data: string,
  signal: AbortSignal,
  onSubmit: () => void,
): ReturnType<typeof invoke> {
  const mux = new RemoteStreamMuxClient(path => client.openSocket(path, openDeviceStreamSocket))
  const uplink = new ClientUplinkQueue(call.endpoint)
  let sent = false
  mux.start()
  try {
    for await (const frame of mux.open(call.endpoint, { args: call.args }, signal, uplink)) {
      if (frame === null || typeof frame !== 'object' || !('type' in frame)) continue
      if (frame.type === 'snapshot' && !sent) {
        if (!('writable' in frame) || frame.writable !== true) return { ok: false, error: 'terminal/read-only' }
        sent = true
        onSubmit()
        uplink.push({ type: 'write', sequence: 1, data, typed: true })
        uplink.end()
      } else if (frame.type === 'ack' && sent && 'sequence' in frame && frame.sequence === 1) {
        if ('refusal' in frame) return { ok: false, error: 'terminal/input-refused' }
        return { ok: true, value: { accepted: true } }
      }
    }
    throw new Error('terminal stream ended before acknowledging input')
  } finally {
    uplink.close()
    await mux.close()
  }
}

/** Explain a refused pairing exchange; undefined for every other failure. */
function pairingFailure(error: unknown): string | undefined {
  if (!(error instanceof DeviceClientError)) return undefined
  switch (error.code) {
    case 'DEVICE_PAIRING_REJECTED':
      return 'ocean connect: the pairing link is invalid, expired, or already used. Create a new one with ocean remote-device pair.'
    case 'DEVICE_PAIRING_UNSUPPORTED':
      return 'ocean connect: the Host does not support pairing links. Update the Host or sign in with a device token.'
    default:
      return undefined
  }
}

/**
 * Parse and run an Ocean remote client command.
 * @param ctx - Profile context containing launcher arguments and lifecycle.
 */
export function runDeviceConnect(ctx: Context): void {
  const program = new Command().name('ocean connect')
    .description('Run a command against an authenticated remote Ocean Host.')
    .option('--url <https-url>', 'Ocean server address')
    .option('--token-env <name>', 'environment variable containing the device token')
    .option('--token-stdin', 'read the device token from redirected standard input')
    .option('--pair <link>', 'pairing link from ocean remote-device pair; exchanges its one-time grant for a device token')
  const run = (call: CommandCall): void => {
    const options = program.opts<{ url?: string; tokenEnv?: string; tokenStdin?: boolean; pair?: string }>()
    const pairing = options.pair === undefined ? undefined : parsePairing(options.pair)
    if (options.pair !== undefined && pairing === undefined) return program.error('ocean connect: --pair needs a pairing link from ocean remote-device pair')
    if (pairing !== undefined && (options.url !== undefined || options.tokenEnv !== undefined || options.tokenStdin === true)) {
      return program.error('ocean connect: --pair takes a pairing link alone, without --url, --token-env, or --token-stdin')
    }
    const address = pairing?.address ?? options.url
    if (address === undefined) return program.error('ocean connect: supply --url with a device token, or --pair with a pairing link')
    let envToken: string | undefined
    if (pairing === undefined) {
      const fromStdin = options.tokenStdin === true
      if ((options.tokenEnv !== undefined) === fromStdin) {
        return program.error('ocean connect: supply exactly one of --token-env and --token-stdin')
      }
      if (fromStdin && process.stdin.isTTY) {
        return program.error('ocean connect: --token-stdin requires a pipe or redirected input')
      }
      envToken = options.tokenEnv === undefined ? undefined : process.env[options.tokenEnv]
      if (options.tokenEnv !== undefined && !envToken) return program.error('ocean connect: the configured token environment variable is empty')
    }
    let client: DeviceClient
    try {
      client = new DeviceClient(address)
    } catch (_error) {
      program.error('ocean connect: use an HTTPS URL without credentials, query, or fragment')
    }
    const ready = ctx.get('appReady')
    const exit = ctx.get('appExit')
    if (ready === undefined || exit === undefined) throw new Error('ocean connect requires the profile launcher')
    ctx.effect(() => {
      const controller = new AbortController()
      const detach = ready.onReady(() => {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)])
        void (async () => {
          let submitted = false
          try {
            let token: string
            if (pairing === undefined) {
              try {
                token = envToken ?? await readDeviceToken(signal)
                if (!token) throw new Error('Empty token input')
              } catch (_error) {
                if (!controller.signal.aborted) {
                  console.error('ocean connect: could not read a device token from standard input.')
                  exit(1)
                }
                return
              }
            } else {
              // The link is spent even if this process loses the token, so name where the token can be kept.
              const paired = await client.pair(pairing.secret, signal)
              token = paired.token
              console.error(`ocean connect: paired device ${paired.id}. Keep its token for --token-env: ${token}`)
            }
            const host = await client.login(token, signal)
            let result: CommandResult
            try {
              if (call.requestId !== undefined) console.error(`ocean connect: request ID ${call.requestId}`)
              submitted = call.mutation === true
              if (call.upload !== undefined) {
                result = await uploadFile(client, call.upload, signal, () => { submitted = true })
              } else if (call.terminalInput !== undefined) {
                result = await writeTerminal(client, call, call.terminalInput, signal, () => { submitted = true })
              } else if (call.stream) {
                await observeStream(client, call, host.epoch, controller.signal)
                result = { ok: true, value: undefined }
              } else {
                result = await invoke(client, call, signal)
              }
            } finally {
              if (!controller.signal.aborted) {
                const cleanupSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(5_000)])
                await client.logout(cleanupSignal).catch(() => {
                  console.error('ocean connect: could not close the remote login. It will expire on the Host.')
                })
              }
            }
            if (controller.signal.aborted) return
            if (result.ok) {
              if (!call.stream) console.log(JSON.stringify(result.value ?? null))
              exit(0)
            } else {
              console.error(result.error.startsWith('local/')
                ? `ocean connect: could not open the local file (${result.error}).`
                : `ocean connect: Host rejected ${call.endpoint} (${result.error}).`)
              exit(1)
            }
          } catch (error) {
            if (controller.signal.aborted) return
            const pairingRefused = submitted ? undefined : pairingFailure(error)
            if (pairingRefused !== undefined) {
              console.error(pairingRefused)
            } else if (!submitted && error instanceof DeviceSessionRejectedError) {
              console.error('ocean connect: the remote session ended. Run the command again with an active device token.')
            } else if (!submitted) {
              console.error('ocean connect: remote request failed. Check the HTTPS address, certificate, token and protocol version.')
            } else if (call.endpoint === 'session/prompt' && call.requestId !== undefined) {
              console.error(`ocean connect: prompt result is unknown. To retry the same prompt, reuse request ID ${call.requestId} with --request-id.`)
            } else if (call.endpoint === 'terminal/create' && call.requestId !== undefined) {
              console.error(`ocean connect: terminal creation result is unknown. List the Host terminals and look for ID ${call.requestId} before retrying.`)
            } else if (call.upload !== undefined) {
              console.error('ocean connect: upload result is unknown. No attachment receipt was confirmed.')
            } else {
              console.error('ocean connect: command result is unknown. Inspect remote session state before retrying.')
            }
            exit(1)
          }
        })()
      })
      return () => { detach(); controller.abort() }
    }, 'connect: run remote command')
  }
  /**
   * Pair without running a command. The token is the only thing worth keeping,
   * and running a command just to discard its output hides it in noise.
   */
  const pairAlone = (): void => {
    const options = program.opts<{ url?: string; tokenEnv?: string; tokenStdin?: boolean; pair?: string }>()
    // Bare `ocean connect` is a usage error, so its help exits non-zero as it did before pairing existed.
    if (options.pair === undefined) { program.help({ error: true }); return }
    const pairing = parsePairing(options.pair)
    if (pairing === undefined) { program.error('ocean connect: --pair needs a pairing link from ocean remote-device pair'); return }
    if (options.url !== undefined || options.tokenEnv !== undefined || options.tokenStdin === true) {
      program.error('ocean connect: --pair takes a pairing link alone, without --url, --token-env, or --token-stdin'); return
    }
    const client = new DeviceClient(pairing.address)
    const ready = ctx.get('appReady')
    const exit = ctx.get('appExit')
    if (ready === undefined || exit === undefined) throw new Error('ocean connect requires the profile launcher')
    ctx.effect(() => {
      const controller = new AbortController()
      const detach = ready.onReady(() => {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)])
        void (async () => {
          try {
            const paired = await client.pair(pairing.secret, signal)
            // The link is spent even if this process loses the token, so name where the token can be kept.
            console.error(`ocean connect: paired device ${paired.id}. Keep its token for --token-env: ${paired.token}`)
            exit(0)
          } catch (error) {
            if (controller.signal.aborted) return
            console.error(pairingFailure(error)
              ?? 'ocean connect: pairing failed. Check the HTTPS address, certificate, and protocol version.')
            exit(1)
          }
        })()
      })
      return () => { detach(); controller.abort() }
    }, 'connect: pair without a command')
  }
  program.action(pairAlone)
  // An action handler suppresses the implicit `help` command, so it is restored here.
  program.helpCommand(true)
  program.command('list').description('List remote sessions as JSON')
    .action(() => { run({ endpoint: 'session/list', args: { _request: {} } }) })
  program.command('create').description('Create a remote session')
    .option('--cwd <path>', 'working directory on the Host')
    .action((options: { cwd?: string }) => { run({
      endpoint: 'session/create', mutation: true,
      args: { request: options.cwd === undefined ? {} : { cwd: options.cwd } },
    }) })
  program.command('history').argument('<session-id>').description('Read a remote history page')
    .option('--before-seq <seq>', 'exclusive event sequence at the end of the page')
    .action((sessionId: string, options: { beforeSeq?: string }) => {
      const beforeSeq = options.beforeSeq === undefined ? undefined : Number(options.beforeSeq)
      if (options.beforeSeq !== undefined && (!/^\d+$/u.test(options.beforeSeq) || !Number.isSafeInteger(beforeSeq))) {
        program.error('ocean connect: --before-seq must be a non-negative integer')
      }
      run({
        endpoint: 'session/events',
        args: { request: { address: { kind: 'session', sessionId }, ...beforeSeq === undefined ? {} : { beforeSeq } } },
      })
    })
  program.command('follow').argument('<session-id>').description('Stream snapshots and live remote session history')
    .action((sessionId: string) => { run({
      endpoint: 'session/follow', stream: true,
      args: { request: { address: { kind: 'session', sessionId } } },
    }) })
  program.command('state').argument('<session-id>').description('Read remote session and pending input state')
    .action((sessionId: string) => { run({
      endpoint: 'session/state', args: { request: { sessionId } },
    }) })
  program.command('wait').argument('<session-id>').description('Wait briefly for idle state or pending input')
    .action((sessionId: string) => { run({
      endpoint: 'session/wait', args: { request: { sessionId, timeoutMs: 15_000 } },
    }) })
  program.command('files').argument('<session-id>').argument('[path]', 'Host workspace directory', '.')
    .description('List files in a remote session workspace')
    .action((sessionId: string, path: string) => { run({
      endpoint: 'workspaceFiles/list', args: { workspaceFileScopeId: sessionId, path },
    }) })
  program.command('read').argument('<session-id>').argument('<path>')
    .description('Read a page of a text file on the Host')
    .option('--offset <line>', 'first line to read, starting at 1')
    .option('--limit <lines>', 'maximum number of lines')
    .action((sessionId: string, path: string, options: { offset?: string; limit?: string }) => {
      const range: { offset?: number; limit?: number } = {}
      for (const field of ['offset', 'limit'] as const) {
        const value = options[field]
        if (value === undefined) continue
        const parsed = Number(value)
        if (!/^\d+$/u.test(value) || !Number.isSafeInteger(parsed) || parsed < 1) {
          program.error(`ocean connect: --${field} must be a positive integer`)
        }
        range[field] = parsed
      }
      run({ endpoint: 'workspaceFiles/read', args: { workspaceFileScopeId: sessionId, path, range } })
    })
  program.command('upload').argument('<session-id>').argument('<local-path>')
    .description('Stream a local file to the Host and return its prompt attachment receipt')
    .action((sessionId: string, path: string) => { run({
      endpoint: 'upload', args: {}, upload: { sessionId, path },
    }) })
  program.command('terminals').argument('<session-id>').description('List terminals retained on the Host')
    .action((sessionId: string) => { run({ endpoint: 'terminal/list', args: { sessionId } }) })
  program.command('terminal-create').argument('<session-id>')
    .option('--id <id>', 'reuse the same terminal identity if the reply was lost')
    .description('Create a terminal on the Host')
    .action((agentId: string, options: { id?: string }) => {
      const id = options.id ?? randomUUID()
      if (!/^[\w-]{1,128}$/u.test(id)) program.error('ocean connect: invalid terminal ID')
      run({
        endpoint: 'terminal/create', mutation: true,
        args: { agentId, request: { id, cols: 80, rows: 24 } },
        requestId: id,
      })
    })
  program.command('terminal-watch').argument('<session-id>').argument('<terminal-id>')
    .description('Stream the current terminal screen and subsequent output as JSON lines')
    .action((agentId: string, id: string) => { run({
      endpoint: 'terminal/attach', stream: true, args: { agentId, id },
    }) })
  program.command('terminal-write').argument('<session-id>').argument('<terminal-id>').argument('<text>')
    .description('Send one text input to a Host terminal and wait for acceptance')
    .action((agentId: string, id: string, terminalInput: string) => {
      if (terminalInput.length === 0) program.error('ocean connect: terminal input must not be empty')
      run({ endpoint: 'terminal/attach', args: { agentId, id }, terminalInput })
    })
  program.command('terminal-close').argument('<session-id>').argument('<terminal-id>')
    .description('Close a terminal on the Host')
    .action((agentId: string, id: string) => { run({
      endpoint: 'terminal/close', mutation: true, args: { agentId, id },
    }) })
  program.command('approvals').argument('<session-id>').description('List pending approvals for a remote session')
    .action((sessionId: string) => { run({ endpoint: 'deviceApproval/list', args: { sessionId } }) })
  program.command('questions').argument('<session-id>').description('List pending questions for a remote session')
    .option('--continued', 'list questions retained after the task continued')
    .action((sessionId: string, options: { continued?: boolean }) => { run(options.continued
      ? { endpoint: 'session/projections', args: { request: { sessionId } } }
      : { endpoint: 'deviceQuestion/list', args: { sessionId } }) })
  program.command('answer-question').argument('<session-id>').argument('<question-request-id>').argument('<answer-json>')
    .description('Submit a structured answer to a pending remote question request')
    .option('--continued', 'answer a retained question using its tool call ID')
    .action((sessionId: string, id: string, input: string, options: { continued?: boolean }) => {
      let answer: unknown
      try { answer = JSON.parse(input) } catch (_error) { program.error('ocean connect: expected a JSON answer') }
      run(options.continued
        ? { endpoint: 'userQuestions/answer', mutation: true, args: { agentId: sessionId, callId: id, answer } }
        : { endpoint: 'deviceQuestion/answer', mutation: true, args: { sessionId, id, answer } })
    })
  program.command('approve').argument('<session-id>').argument('<approval-id>').argument('<allow-or-deny>')
    .description('Answer one approval in the specified remote session')
    .action((sessionId: string, id: string, decision: string) => {
      if (decision !== 'allow' && decision !== 'deny') program.error('ocean connect: approval decision must be allow or deny')
      run({ endpoint: 'deviceApproval/answer', mutation: true, args: { sessionId, id, allow: decision === 'allow' } })
    })
  program.command('cancel').argument('<session-id>').description('Cancel active work in the remote session')
    .action((sessionId: string) => { run({
      endpoint: 'session/cancel', mutation: true, args: { request: { sessionId } },
    }) })
  program.command('prompt').argument('<session-id>').argument('<text>')
    .description('Submit or steer a prompt in a remote session')
    .option('--request-id <uuid>', 'reuse the same ID only when retrying the same prompt')
    .option('--steer', 'send input to the active turn')
    .option('--file <receipt-id...>', 'attach one or more uploaded files to this prompt')
    .action((sessionId: string, text: string, options: { requestId?: string; steer?: boolean; file?: string[] }) => {
      const requestId = options.requestId ?? randomUUID()
      if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(requestId) || text.trim().length === 0) {
        program.error('ocean connect: provide non-empty prompt text and a UUID request ID')
      }
      run({
        endpoint: 'session/prompt', mutation: true, requestId,
        args: { request: {
          requestId, sessionId, mode: options.steer ? 'steer' : 'queue',
          content: [{ type: 'text', text }, ...(options.file ?? []).map(receiptId => ({ type: 'file', receiptId }))],
        } },
      })
    })
  parseCmdline(ctx, program)
}
