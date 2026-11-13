/** Explicit child-only route recovery without credentials or provider requests. */
import { Context } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@ocean/ocean-agent-loop-testkit'
import { LlmError, ReasoningEffortId, createUserMessage } from '@ocean/ocean-llm'
import { SessionId } from '@ocean/ocean-session'
import { expect, it, onTestFinished, vi } from 'vitest'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'
import { createSessionTestRemote } from './test-remote.ts'

it.each(['NO_ADAPTER', 'MISSING_CREDENTIAL', 'AUTH'] as const)(
  'recovers %s into an explicitly selected child without changing the source', async (code) => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    await mountAgentLoopTestDependencies(ctx)
    const harness = await mountAgentLoopTestHarness(ctx)
    ctx.provide('workspaceRegistry', { list: () => [], archivedSessionIds: [] } as never)
    if (code !== 'NO_ADAPTER') {
      const unavailable = new MockAdapter([() => { throw new LlmError('credential unavailable', code) }])
      ctx.llm.registerAdapter(['old-provider'], unavailable)
    }
    const available = new MockAdapter([textResponse('continued')], {
      efforts: [{ id: ReasoningEffortId('high'), name: 'High' }],
    })
    vi.spyOn(available, 'listModels').mockResolvedValue([{ provider: 'new-provider', id: 'new-model', name: 'New model' }])
    ctx.llm.registerAdapter(['new-provider'], available)
    const source = await harness.create(SessionId('recovery-source'), { provider: 'old-provider', model: 'old-model' })
    source.session.append('request/header', {
      header: { config: { provider: 'old-provider', model: 'old-model' } }, reason: 'initial',
    })
    source.followup(createUserMessage({ content: [{ type: 'text', text: 'original request' }], source: { kind: 'user' } }))
    await source.whenIdle()
    const before = source.session.snapshotEvents()
    expect(before.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'error', error: { code } } } })
    const remote = await createSessionTestRemote(ctx, {
      defaultModelSelection: () => ({ provider: 'new-provider', model: 'new-model' }), cwd: '/tmp',
    })
    const create = vi.spyOn(ctx.agents, 'create')
    expect(await remote.fork({ sessionId: source.id })).toMatchObject({ ok: false, error: { code: 'session/model-unavailable' } })
    expect(create).not.toHaveBeenCalled()
    expect(await remote.fork({ sessionId: source.id, modelSelection: { provider: 'missing', model: 'missing' } }))
      .toMatchObject({ ok: false, error: { code: 'session/model-unavailable' } })
    expect(create).not.toHaveBeenCalled()
    const selected = { provider: 'new-provider', model: 'new-model', reasoningEffort: 'high' }
    const result = await remote.fork({ sessionId: source.id, modelSelection: selected })
    if (!result.ok) throw result.error
    const child = ctx.agents.get(result.value.sessionId)!
    expect(child.model.current()).toEqual(selected)
    expect(child.session.snapshotEvents().slice(0, before.length)).toEqual(before)
    expect(child.session.snapshotEvents().slice(before.length).map(event => event.type)).toEqual(['session/end-seed', 'model/selection'])
    expect(child.session.snapshotEvents().at(-1)).toMatchObject({ type: 'model/selection', data: selected })
    expect(source.session.snapshotEvents()).toEqual(before)
    expect(available.requests).toEqual([])
    child.followup(createUserMessage({ content: [{ type: 'text', text: 'continue explicitly' }], source: { kind: 'user' } }))
    await child.whenIdle()
    expect(available.requests).toHaveLength(1)
    expect(available.requests[0]).toMatchObject({ provider: 'new-provider', model: 'new-model' })
    expect(source.session.snapshotEvents()).toEqual(before)
  },
)
