/** Root-fiber shutdown drains buffered session events durably (both mount orders). */

import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { Context, Fiber } from '@deepseek-ai/cordis'
import { setImmediate } from 'node:timers/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUserMessage } from '@ocean/ocean-llm'
import LlmRuntime from '@ocean/ocean-llm'
import SessionStore, { SessionId } from '@ocean/ocean-session'
import SessionProjectionRegistry from '@ocean/ocean-session-projection'
import SystemPrompt from '@ocean/ocean-system-prompt'
import ToolRuntime from '@ocean/ocean-tools'
import AgentRegistry, { type Agent } from '@ocean/ocean-agent'
import * as JsonlSessionPersistence from '@ocean/ocean-session-persistence-jsonl'
import AgentLoop from '@ocean/ocean-agent-loop'
import { MockAdapter, textResponse } from './mock-adapter.ts'

const dirs: string[] = []
afterEach(async () => { for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true }) })

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') { dispose(); resolve() }
    })
  })
}

async function mount(order: 'backend-first' | 'loop-first'): Promise<{ ctx: Context; root: string; backend: Fiber; loop: Fiber }> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-shutdown-drain-'))
  dirs.push(root)
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(AgentRegistry)
  let backend: Fiber
  let loop: Fiber
  if (order === 'backend-first') {
    backend = await ctx.plugin(JsonlSessionPersistence, { root })
    loop = await ctx.plugin(AgentLoop, { agents: [] })
  } else {
    loop = await ctx.plugin(AgentLoop, { agents: [] })
    backend = await ctx.plugin(JsonlSessionPersistence, { root })
  }
  ctx.llm.registerAdapter(['mock'], new MockAdapter([textResponse('done')]))
  return { ctx, root, backend, loop }
}

describe.each(['backend-first', 'loop-first'] as const)('root shutdown drain (%s)', (order) => {
  it.each(['root', 'backend', 'owner'] as const)('retains persistence while an active request unwinds during %s disposal', async (target) => {
    const { ctx, root, backend, loop } = await mount(order)
    const entered = Promise.withResolvers<undefined>()
    const release = Promise.withResolvers<undefined>()
    const cancelled = Promise.withResolvers<undefined>()
    ctx.on('agent/request', async ({ signal }, next) => {
      signal.addEventListener('abort', () => { cancelled.resolve(undefined) }, { once: true })
      entered.resolve(undefined)
      await release.promise
      return next()
    })
    const initialEffects = loop.getEffects().map(effect => effect.label)
    let ownerCtx!: Context
    const owner = await ctx.plugin({
      name: 'shutdown-test-owner',
      inject: ['agents'],
      apply(child: Context) { ownerCtx = child },
    })
    const sessionId = SessionId('shutdown-active-drain')
    const { agent } = await ownerCtx.agents.create({ sessionId, agentOptions: { provider: 'mock', model: 'mock' } })
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'q' }], source: { kind: 'user' } }))
    await entered.promise
    await ctx.sessions.flush(agent.session)
    const disposal = target === 'root' ? ctx.fiber.dispose() : target === 'backend' ? backend.dispose() : owner.dispose()
    // Let concurrent disposal advance while the request is still in flight.
    await cancelled.promise
    await setImmediate()
    release.resolve(undefined)
    await disposal
    if (target !== 'root') {
      expect(loop.getEffects().map(effect => effect.label)).toEqual(initialEffects)
    }

    const verify = new Context()
    try {
      await verify.plugin(JsonlSessionPersistence, { root })
      const reader = await verify.sessionPersistence.open(sessionId, 'read')
      const { events } = await reader.read()
      await reader.close()
      expect(events.map(event => event.type)).toContain('step/end')
      expect(events.at(-1)).toMatchObject({ type: 'turn/end' })
      expect(events).toEqual(agent.session.snapshotEvents())
      if (target === 'backend') {
        await ctx.plugin(JsonlSessionPersistence, { root })
        expect(loop.getEffects().map(effect => effect.label)).toEqual(initialEffects)
        expect(ctx.agents.get(agent.id)).toBeUndefined()
        const replacement = await ctx.agents.create({ sessionId: SessionId('after-backend-reload') })
        await replacement.dispose()
        await setImmediate()
        expect(loop.getEffects().map(effect => effect.label)).toEqual(initialEffects)
      }
    } finally {
      await verify.fiber.dispose()
      await ctx.fiber.dispose()
    }
  })

  it('releases initialization resources if the persistence dependency fails to activate', async () => {
    const { ctx, loop } = await mount(order)
    const before = loop.getEffects().map(effect => effect.label)
    const failure = new Error('dependency activation failed')
    const wait = vi.spyOn(Fiber.prototype, 'await').mockRejectedValueOnce(failure)
    try {
      await expect(ctx.agents.create({ sessionId: SessionId('failed-dependency') })).rejects.toBe(failure)
    } finally {
      wait.mockRestore()
    }
    expect(ctx.agents.get(SessionId('failed-dependency'))).toBeUndefined()
    expect(ctx.sessions.get(SessionId('failed-dependency'))).toBeUndefined()
    expect(loop.getEffects().map(effect => effect.label)).toEqual(before)
    const retry = await ctx.agents.create({ sessionId: SessionId('failed-dependency') })
    await retry.dispose()
    await ctx.fiber.dispose()
  })

  it('persists buffered turn events without an explicit flush before dispose', async () => {
    const { ctx, root } = await mount(order)
    const sessionId = SessionId('shutdown-drain')
    const handle = await ctx.agents.create({ sessionId, agentOptions: { provider: 'mock', model: 'mock' } })
    handle.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'q' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, handle.agent)
    // No explicit flush and no agent dispose: root teardown must drain.
    await ctx.fiber.dispose()

    const verify = new Context()
    await verify.plugin(JsonlSessionPersistence, { root })
    const reader = await verify.sessionPersistence.open(sessionId, 'read')
    const { events } = await reader.read()
    await reader.close()
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
    await verify.fiber.dispose()
  })
})
