/** Test-only IPC observer mounted beside the unchanged default Web composition. */

import type { Context } from '@deepseek-ai/cordis'
import { runtimeRoster } from '../runtime-roster.ts'

/** Services whose live state the observer reads. */
export const inject = ['loader', 'clientModules']

/**
 * Observe the shipped process and report its runtime roster on request.
 * @param ctx - context in the real Loader tree.
 */
export function apply(ctx: Context): void {
  if (process.send === undefined) throw new Error('Runtime roster observer requires an IPC channel')
  const receive = (message: unknown): void => {
    if (message === 'stop') {
      process.emit('SIGTERM')
      return
    }
    if (message !== 'roster') return
    void (async () => {
      await ctx.loader.await()
      process.send!({ command: message, roster: runtimeRoster(ctx) })
    })().catch((error: unknown) => {
      process.send!({ command: message, error: error instanceof Error ? error.stack : String(error) })
    })
  }
  ctx.effect(() => {
    process.on('message', receive)
    return () => { process.off('message', receive) }
  })
}
