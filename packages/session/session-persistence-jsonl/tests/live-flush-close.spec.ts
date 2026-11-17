/** A live durability checkpoint joins a closing writer without hiding its close failure. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@ocean/ocean-session'
import { expect, it, onTestFinished, vi } from 'vitest'
import * as JsonlSessionPersistence from '../src/index.ts'
import { SessionWriteLease } from '../src/lease.ts'

it.each([false, true])('waits for a closing writer and preserves its result (release fails: %s)', async (fails) => {
  const root = await mkdtemp(join(tmpdir(), 'ocean-live-flush-close-'))
  const ctx = new Context()
  onTestFinished(async () => {
    await ctx.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  })
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  const session = ctx.sessions.create(SessionId('closing-writer'))
  const handle = await ctx.sessionPersistence.create(session.header)
  session.append('turn/start', { turn: 1 })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  await ctx.sessions.flush(session)

  const release = Promise.withResolvers<undefined>()
  const failure = Object.assign(new Error('write-lock release failed'), { code: 'EIO' })
  // oxlint-disable-next-line typescript/unbound-method -- The wrapper restores the original lease receiver with call.
  const originalRelease = SessionWriteLease.prototype.release
  const releaseSpy = vi.spyOn(SessionWriteLease.prototype, 'release').mockImplementationOnce(async function (this: SessionWriteLease) {
    await release.promise
    await originalRelease.call(this)
    if (fails) throw failure
  })
  const originalClose = handle.close.bind(handle)
  const closeSpy = vi.spyOn(handle, 'close')
  const closing = originalClose().then(() => undefined, (error: unknown) => error)
  let settled = false
  let flushing: Promise<unknown> | undefined
  try {
    await vi.waitFor(() => { expect(releaseSpy).toHaveBeenCalledOnce() })
    flushing = ctx.sessions.flush(session).then(
      (value) => { settled = true; return value },
      (error: unknown) => { settled = true; return error },
    )
    await vi.waitFor(() => { expect(closeSpy).toHaveBeenCalledOnce() })
    expect(settled).toBe(false)
    release.resolve(undefined)
    expect(await closing).toBe(fails ? failure : undefined)
    expect(await flushing).toBe(fails ? failure : true)
    const reader = await ctx.sessionPersistence.open(session.id, 'read')
    try {
      expect((await reader.read()).events).toEqual(session.snapshotEvents())
    } finally {
      await reader.close()
    }
  } finally {
    release.resolve(undefined)
    await Promise.all([closing, flushing])
    closeSpy.mockRestore()
    releaseSpy.mockRestore()
  }
})
