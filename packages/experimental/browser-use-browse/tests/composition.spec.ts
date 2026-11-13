import BrowserSetup from '../src/setup.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import BrowserUse from '@ocean/ocean-browser-use'
import SystemPrompt from '@ocean/ocean-system-prompt'
import Tools from '@ocean/ocean-tools'
import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import Llm, { LlmAdapter, ToolCallId, createUserMessage } from '@ocean/ocean-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@ocean/ocean-llm'
import Sessions, { SessionId } from '@ocean/ocean-session'
import Agents from '@ocean/ocean-agent'
import AgentLoop from '@ocean/ocean-agent-loop'
import Projections from '@ocean/ocean-session-projection'
import { afterEach, expect, it } from 'vitest'
import * as Browser from '../src/index.ts'
import { fixture, cleanupFixture } from './fixture.ts'

class Model extends LlmAdapter {
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text'] })
  }
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.messages.at(-1)?.role === 'user') {
      const call = { type: 'tool-call' as const, id: ToolCallId('browse'), name: 'ocean_browser_navigate', arguments: '{"url":"https://example.com"}' }
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: call.id, name: call.name, argumentsDelta: call.arguments }
      yield { type: 'block-end', index: 0, block: call }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
    } else {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: 'Read the page.' }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Read the page.' } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    }
  }
}
afterEach(cleanupFixture)
it.each([false, true])('Loader isolates sessions and retains failed acquisition tombstones: %s', async (failStartup) => {
  const f = await fixture(failStartup ? { failNew: true, failDelete: true } : {})
  const root = await mkdtemp(join(tmpdir(), 'ocean-browse-loader-'))
  const ctx = new Context()
  try {
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    Object.assign(ctx.loader.builtins, { include: Include, browserSetup: BrowserSetup, browserUse: BrowserUse, prompt: SystemPrompt,
      tools: Tools, executor: NativeToolExecutor,
      llm: Llm, sessions: Sessions, agents: Agents, loop: AgentLoop, projections: Projections, browser: Browser,
      model: { inject: ['llm'], apply(inner: Context) { inner.effect(() => inner.llm.registerAdapter(['fixture'], new Model())) } },
    })
    const rows = ['browserSetup','browserUse','prompt','tools','executor','llm','sessions','agents','loop','projections','model','browser'].map(id => ({ id, name: `cordis:${id}`, config: id === 'browser' ? { enabled: true, ...f.config } : id === 'loop' ? { agents: [] } : {} }))
    const path = join(root, 'cordis.yml'); await writeFile(path, JSON.stringify(rows))
    await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(path).href } }); await ctx.loader.await()
    const a = await ctx.agents.create({ sessionId: SessionId('a'), agentOptions: { provider: 'fixture', model: 'test' } })
    const b = await ctx.agents.create({ sessionId: SessionId('b'), agentOptions: { provider: 'fixture', model: 'test' } })
    for (const owner of [a,b]) {
      owner.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Read the approved page.' }], source: { kind: 'user' } }))
      await owner.agent.whenIdle()
      if (!failStartup) expect(JSON.stringify(owner.agent.session.snapshotEvents())).toContain('page snapshot')
      else {
        expect(JSON.stringify(owner.agent.session.snapshotEvents())).toContain('cleanup were not confirmed')
        owner.agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Try again.' }], source: { kind: 'user' } }))
        await owner.agent.whenIdle()
      }
    }
    const ids = f.calls.filter(c => c.path.endsWith('/new')).map(c => c.body.id)
    expect(new Set(ids).size).toBe(2)
    await a.dispose(); await b.dispose()
    expect(f.calls.filter(c => c.path.endsWith('/delete')).map(c => c.body.id).sort()).toEqual(ids.sort())
  } finally { await ctx.fiber.dispose(); await rm(root, { recursive: true, force: true }) }
})
