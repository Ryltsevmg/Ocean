/** One managed, isolated Python helper per Agent; cancellation invalidates its handles. */
import { Writable } from 'node:stream'
import assert from 'node:assert/strict'
import { NativeError, type NativeChannelFactory } from '@ocean/ocean-cua/native-client'

/**
 * Create isolated helper channels that terminate on cancellation instead of acknowledging uncertain actions.
 * @param python Absolute system Python with PyGObject/AT-SPI.
 * @param sessionId Explicit logind binding, never inferred from environment.
 * @returns Managed native channel factory.
 */
export function createLinuxChannel(python: string, sessionId?: string): NativeChannelFactory {
  return ({ subprocess }, config) => {
    const handle = subprocess.spawn({
      argv: [python, '-I', config.helperPath, '--max-request-bytes', String(config.maxRequestBytes),
        '--max-response-bytes', String(config.maxResponseBytes), ...(sessionId === undefined ? [] : ['--session-id', sessionId])],
      cwd: config.cwd, graceMs: config.graceMs,
      stdio: { stdin: 'pipe', stdout: 'pipe', stderr: { maxBytes: 16_384 } },
    })
    assert(handle.stdin && handle.stdout, 'Linux CUA requires managed standard streams')
    const childStdin = handle.stdin
    let closed = false
    const close = () => { if (!closed) { closed = true; handle.terminate() } }
    const done = handle.done.then((outcome) => {
      if (outcome.exitCode !== 0 || outcome.signal !== null)
        throw new NativeError('NATIVE_EXITED', 'Linux accessibility helper stopped; an in-flight action may have completed. Read fresh state before further input.')
    })
    void done.catch(() => {})
    const stdin = new Writable({ write(chunk: Buffer, _encoding, callback) {
      try {
        // NativeClient emits a single complete JSONL request per write. Cancellation cannot
        // undo an already delivered AT-SPI action, so terminate instead of acknowledging it.
        const message: unknown = JSON.parse(chunk.toString('utf8'))
        if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'cancel') {
          close(); callback(); return
        }
        if (closed) { callback(new NativeError('NATIVE_CLOSED', 'Linux helper is closed')); return }
        childStdin.write(chunk, callback)
      } catch (error) { callback(error instanceof Error ? error : new Error(String(error))) }
    } })
    handle.stdin.on('error', (error: Error) => { stdin.destroy(error); close() })
    return { stdin, stdout: handle.stdout, done, close,
      async waitForClose() {
        await handle.done
        if (!await handle.waitForExit()) throw new NativeError('NATIVE_CLEANUP', 'Linux helper did not exit')
      },
    }
  }
}
