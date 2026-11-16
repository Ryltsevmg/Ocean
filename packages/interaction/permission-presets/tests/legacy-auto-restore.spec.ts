/**
 * Persisted legacy Auto sessions, written by releases that shipped the retired auto-review integration, restore
 * confined to the read-only sandbox with approvals required and retain their history; the confinement append is
 * idempotent across restarts. Seeded Auto history without the integration stays rejected (covered beside).
 * @module
 */
import { describe, expect, it, onTestFinished } from 'vitest'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@ocean/ocean-agent-loop-testkit'
import { Context } from '@deepseek-ai/cordis'
import { SessionId, SessionSeq, SESSION_FORMAT_VERSION } from '@ocean/ocean-session'
import type { SessionEvent } from '@ocean/ocean-session'
import * as JsonlSessionPersistence from '@ocean/ocean-session-persistence-jsonl'
import PermissionPresetService, { AUTO_PRESET } from '@ocean/ocean-permission-presets'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function boot(root: string): Promise<Context> {
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  await mountAgentLoopTestDependencies(ctx)
  await mountAgentLoopTestHarness(ctx)
  ctx.provide('shell', {
    sandboxMode: 'workspace-write',
    resolve() { throw new Error('permission tests do not execute bash') },
    run() { throw new Error('permission tests do not execute bash') },
    start() { throw new Error('permission tests do not execute bash') },
  })
  ctx.provide('approval', { config: { policy: 'ask' } })
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  await ctx.plugin(PermissionPresetService, {})
  return ctx
}

describe('legacy Auto session recovery', () => {
  it('confines a persisted Auto session across provider restarts and retains its history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-legacy-auto-'))
    onTestFinished(() => rm(root, { recursive: true, force: true }))
    const id = SessionId('legacy-auto-disk')

    const writer = await boot(root)
    const handle = await writer.sessionPersistence.create({
      version: SESSION_FORMAT_VERSION,
      id,
      createdAt: 1_700_000_000_000,
      cwd: root,
      isSeeded: false,
    })
    const legacy: SessionEvent[] = [
      { type: 'permission/preset', seq: SessionSeq(0), time: 1, data: { preset: AUTO_PRESET } },
      { type: 'sandbox/mode', seq: SessionSeq(1), time: 2, data: { mode: 'danger-full-access' } },
      { type: 'approval/policy', seq: SessionSeq(2), time: 3, data: { policy: 'never' } },
      { type: 'turn/start', seq: SessionSeq(3), time: 4, data: { turn: 1 } },
      { type: 'turn/end', seq: SessionSeq(4), time: 5, data: { turn: 1, reason: { kind: 'completed' } } },
    ]
    await handle.append(legacy)
    await handle.flush()
    await handle.close()
    await writer.fiber.dispose()

    const reader = await boot(root)
    const restored = (await reader.agents.resume({ resumeSessionId: id })).agent.session
    const events = restored.snapshotEvents()
    expect(events.slice(0, legacy.length).map(event => [event.type, event.data])).toEqual(legacy.map(event => [event.type, event.data]))
    expect(events.slice(-2).map(event => [event.type, event.data])).toEqual([
      ['sandbox/mode', { mode: 'read-only' }],
      ['approval/policy', { policy: 'ask' }],
    ])
    expect(reader.sessionProjections.checkpoint(restored).permissions?.val).toMatchObject({
      sandbox: 'read-only',
      approval: 'ask',
    })
    const confinedCount = events.filter(event => event.type !== 'session/end-seed').length
    await reader.fiber.dispose()

    const reopener = await boot(root)
    const reopened = (await reopener.agents.resume({ resumeSessionId: id })).agent.session
    expect(reopened.snapshotEvents().filter(event => event.type !== 'session/end-seed')).toHaveLength(confinedCount)
  })
})
