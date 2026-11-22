/**
 * Host-side bridge to the Electron main process: the private IPC transport and
 * the bounded request/response queue. Internal to this package; same-package
 * tests import this module directly.
 * @module
 */
import { HarnessError } from '@ocean/ocean-error'
import type {
  BrowserAgentCommand,
  BrowserAgentImage,
  BrowserAgentMethod,
  BrowserAgentResult,
} from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'

/** Host-side transport to the Electron main process; injectable for tests. */
export interface DesktopBrowserTransport {
  send(command: BrowserAgentCommand): Promise<void>
  subscribe(listener: (message: unknown) => void): () => void
}

/** Validate one main-process result without trusting its fields. */
function isResult(value: unknown): value is BrowserAgentResult {
  if (typeof value !== 'object' || value === null || !('type' in value) || value.type !== 'browser-agent-result') return false
  const result = value as Record<string, unknown>
  if (!Number.isSafeInteger(result.requestId) || (result.requestId as number) < 0) return false
  if (result.ok === true) {
    if (typeof result.text !== 'string') return false
    if (result.image === undefined) return true
    const image = result.image as Record<string, unknown>
    return typeof image.data === 'string' && image.mediaType === 'image/png'
      && Number.isSafeInteger(image.width) && Number.isSafeInteger(image.height)
  }
  if (result.ok !== false) return false
  const error = result.error
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    && 'message' in error && typeof error.message === 'string'
}

/** One request/response bridge with a bounded wait per command. */
export class BrowserAgentRequester {
  private readonly pending = new Map<number, {
    readonly resolve: (observation: { text: string; image?: BrowserAgentImage }) => void
    readonly reject: (error: Error) => void
    readonly timer: ReturnType<typeof setTimeout>
    readonly abort: () => void
    readonly signal: AbortSignal
  }>()
  private next = 1
  private readonly stop: () => void

  /** @param transport - private Host-to-main channel. */
  constructor(private readonly transport: DesktopBrowserTransport) {
    this.stop = transport.subscribe((message) => {
      if (!isResult(message)) return
      const entry = this.pending.get(message.requestId)
      if (entry === undefined) return
      this.settle(message.requestId, entry)
      if (message.ok) entry.resolve({ text: message.text, ...message.image === undefined ? {} : { image: message.image } })
      else entry.reject(new HarnessError(message.error.message, message.error.code))
    })
  }

  /**
   * Send one command and await its answer.
   * @param session - exact Session identity.
   * @param method - operation name.
   * @param args - validated JSON arguments.
   * @param signal - caller cancellation.
   * @param timeoutMs - how long the main process may take; handoff outlives the actions.
   * @returns model-facing text.
   */
  async request(session: string, method: BrowserAgentMethod,
    args: Readonly<Record<string, string | number>>, signal: AbortSignal,
    timeoutMs = 30_000): Promise<{ text: string; image?: BrowserAgentImage }> {
    if (signal.aborted) throw new HarnessError('The browser action was canceled.', 'ABORTED')
    const requestId = this.next++
    const timer = setTimeout(() => {
      const entry = this.pending.get(requestId)
      /* v8 ignore next 2 -- every settlement path clears this timer; the guard only covers a raced fire. */
      if (entry === undefined) return
      this.pending.delete(requestId)
      entry.signal.removeEventListener('abort', entry.abort)
      entry.reject(new HarnessError('The shared tab did not answer in time.', 'BROWSER_TIMEOUT'))
    }, timeoutMs)
    timer.unref()
    return new Promise<{ text: string; image?: BrowserAgentImage }>((resolve, reject) => {
      const abort = (): void => {
        this.pending.delete(requestId)
        clearTimeout(timer)
        reject(new HarnessError('The browser action was canceled.', 'ABORTED'))
      }
      this.pending.set(requestId, { resolve, reject, timer, abort, signal })
      signal.addEventListener('abort', abort, { once: true })
      void this.transport.send({
        type: 'browser-agent-command', requestId, sessionId: session, method, args,
      }).catch((error: unknown) => {
        const entry = this.pending.get(requestId)
        if (entry !== undefined) this.settle(requestId, entry)
        reject(error instanceof Error ? error : new Error(String(error)))
      })
    })
  }

  /** Release the subscription and fail every outstanding request. */
  dispose(): void {
    this.stop()
    for (const [requestId, entry] of this.pending) {
      this.settle(requestId, entry)
      entry.reject(new HarnessError('The desktop browser bridge closed.', 'BROWSER_BRIDGE_CLOSED'))
    }
  }

  private settle(requestId: number, entry: {
    readonly timer: ReturnType<typeof setTimeout>
    readonly abort: () => void
    readonly signal: AbortSignal
  }): void {
    this.pending.delete(requestId)
    clearTimeout(entry.timer)
    entry.signal.removeEventListener('abort', entry.abort)
  }
}

/** Private IPC transport used by the real Desktop Host process.
 * @returns transport over Node's child-process IPC channel.
 */
export function processTransport(): DesktopBrowserTransport {
  return {
    send: command => new Promise<void>((resolve, reject) => {
      if (!process.connected || process.send === undefined) {
        reject(new Error('The desktop browser bridge is unavailable outside the desktop application.'))
        return
      }
      process.send(command, (error) => { if (error === null) resolve(); else reject(error) })
    }),
    subscribe: (listener) => {
      process.on('message', listener)
      return () => { process.off('message', listener) }
    },
  }
}
