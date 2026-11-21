/** Real-composition coverage: the Desktop browser tools boot through Cordis Loader. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@ocean/ocean-agent'
import BrowserUseRegistry from '@ocean/ocean-browser-use'
import { ToolCallId } from '@ocean/ocean-llm'
import SystemPrompt from '@ocean/ocean-system-prompt'
import ToolRuntime from '@ocean/ocean-tools'
import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import { executeToolFixture } from '@ocean/ocean-tool-testkit'
import { describe, expect, it } from 'vitest'
import type { BrowserAgentCommand } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'
import { installDesktopBrowserAgent, type DesktopBrowserTransport } from '../src/index.ts'

/** Boot the real services plus the Desktop installer over a fake Electron channel. */
async function composition() {
  const directory = await mkdtemp(join(tmpdir(), 'ocean-desktop-browser-'))
  const commands: BrowserAgentCommand[] = []
  const listeners = new Set<(message: unknown) => void>()
  const transport: DesktopBrowserTransport = {
    send: async (command) => {
      commands.push(command)
      for (const listener of listeners) {
        listener({ type: 'browser-agent-result', requestId: command.requestId, ok: true, text: 'button "Save"' })
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(directory).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  Object.assign(ctx.loader.builtins, {
    agents: AgentRegistry,
    systemPrompt: SystemPrompt,
    tools: ToolRuntime,
    toolExecutor: NativeToolExecutor,
    browserUse: BrowserUseRegistry,
    desktopBrowser: {
      name: 'desktopBrowser',
      inject: ['browserUse', 'tools', 'systemPrompt'],
      apply: (scope: Context) => { installDesktopBrowserAgent(scope, transport) },
    },
  })
  const config = join(directory, 'cordis.yml')
  await writeFile(config, [
    '- name: cordis:agents',
    '- name: cordis:systemPrompt',
    '- name: cordis:tools',
    '- name: cordis:toolExecutor',
    '- name: cordis:browserUse',
    '- name: cordis:desktopBrowser',
    '',
  ].join('\n'))
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
  await ctx.loader.await()
  for (const entry of ctx.loader.entries()) await entry.fiber?.await()
  return { ctx, directory, commands }
}

describe('desktop browser real composition', () => {
  it('registers the tools and provider, executes through the real pipeline, and unregisters on disposal', async () => {
    const { ctx, directory, commands } = await composition()
    try {
      const names = ctx.tools.schemas().map(tool => tool.name)
      for (const name of ['browser_info', 'browser_snapshot', 'browser_navigate', 'browser_click',
        'browser_fill', 'browser_back', 'browser_forward', 'browser_reload']) {
        expect(names).toContain(name)
      }
      expect(ctx.browserUse.providerName).toBe('desktop-sidebar')

      const result = await executeToolFixture(ctx, {
        callId: ToolCallId('compose-1'),
        name: 'browser_snapshot',
        arguments: {},
        signal: new AbortController().signal,
        agent: { session: { header: { id: 'session-compose' } } } as never,
      })
      expect(result.isError).toBe(false)
      expect(result.content).toEqual([{ type: 'text', text: 'button "Save"' }])
      expect(commands).toEqual([{ type: 'browser-agent-command', requestId: 1, sessionId: 'session-compose',
        method: 'snapshot', args: {} }])

      const entry = [...ctx.loader.entries()].find(item => item.options.name === 'cordis:desktopBrowser')
      await entry?.fiber?.dispose()
      expect(ctx.tools.schemas().some(tool => tool.name === 'browser_snapshot')).toBe(false)
      expect(ctx.browserUse.providerName).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
