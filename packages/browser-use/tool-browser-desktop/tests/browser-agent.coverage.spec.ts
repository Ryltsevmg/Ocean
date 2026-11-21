/** Branch coverage for the Desktop browser Host bridge and tool bodies. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@ocean/ocean-agent'
import SystemPrompt from '@ocean/ocean-system-prompt'
import ToolRuntime from '@ocean/ocean-tools'
import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { executeToolFixture } from '@ocean/ocean-tool-testkit'
import { ToolCallId } from '@ocean/ocean-llm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolDefinition, ToolRunContext } from '@ocean/ocean-tools'
import type { BrowserAgentCommand } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'
import * as plugin from '../src/index.ts'
import { BrowserAgentRequester, installDesktopBrowserAgent, type DesktopBrowserTransport } from '../src/index.ts'

function execution(agent = true): ToolRunContext {
  return {
    callId: 'call' as never,
    rootCallId: 'call' as never,
    token: 'token' as never,
    name: 'browser_snapshot',
    arguments: {},
    ...(agent ? { agent: { session: { header: { id: 'session-1' } } } as never } : {}),
    signal: new AbortController().signal,
    deferContext: vi.fn(),
    concludeTurn: vi.fn(),
  }
}

function fakeContext(providerName?: string) {
  const registered = new Map<string, ToolDefinition>()
  const browserUse = {
    providerName,
    register: vi.fn(() => async () => {}),
  }
  const ctx = {
    get: vi.fn((name: string) => name === 'browserUse' ? browserUse : undefined),
    browserUse,
    systemPrompt: { section: vi.fn(() => () => {}), getSectionOrder: vi.fn(() => 0) },
    tools: { register: vi.fn((tool: ToolDefinition) => { registered.set(tool.name, tool); return () => {} }) },
    logger: { warn: vi.fn() },
    effect: vi.fn((factory: () => Generator) => {
      const iterator = factory()
      let next = iterator.next()
      while (next.done !== true) next = iterator.next()
      return () => {}
    }),
  }
  return { ctx, registered }
}

function channel() {
  const listeners = new Set<(message: unknown) => void>()
  const commands: BrowserAgentCommand[] = []
  const transport: DesktopBrowserTransport = {
    send: async (command) => {
      commands.push(command)
      for (const listener of listeners) {
        listener({ type: 'browser-agent-result', requestId: command.requestId, ok: true, text: 'ok' })
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return { transport, commands, listeners }
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('tool bodies and presentation', () => {
  it('executes every tool and presents every call', async () => {
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport)
    const args: Record<string, Record<string, string>> = {
      browser_info: {}, browser_snapshot: {}, browser_back: {}, browser_forward: {}, browser_reload: {},
      browser_navigate: { url: 'https://example.test/' },
      browser_click: { ref: 'e1' },
      browser_fill: { ref: 'e1', text: 'hello' },
    }
    for (const [name, toolArgs] of Object.entries(args)) {
      const tool = registered.get(name)!
      await expect(tool.execute(toolArgs, execution())).resolves.toEqual({ text: 'ok' })
      expect(tool.presentCall?.(toolArgs)).toBeDefined()
    }
  })

  it('rejects a call without a live Session', async () => {
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport)
    await expect(registered.get('browser_snapshot')!.execute({}, execution(false)))
      .rejects.toMatchObject({ code: 'BROWSER_SESSION_UNAVAILABLE' })
  })
})

describe('requester edge paths', () => {
  it('ignores malformed results and settles only a valid one', async () => {
    const { transport, listeners } = channel()
    transport.send = async () => {}
    const requester = new BrowserAgentRequester(transport)
    const pending = requester.request('session-1', 'snapshot', {}, new AbortController().signal)
    const listener = [...listeners][0]!
    for (const bad of [null, 42, { type: 'other' },
      { type: 'browser-agent-result', requestId: -1, ok: true, text: 'x' },
      { type: 'browser-agent-result', requestId: 1, ok: true, text: 5 },
      { type: 'browser-agent-result', requestId: 1, ok: 'yes' },
      { type: 'browser-agent-result', requestId: 1, ok: false, error: null },
      { type: 'browser-agent-result', requestId: 1, ok: false, error: { code: 1, message: 'x' } },
      { type: 'browser-agent-result', requestId: 1, ok: false, error: { code: 'C', message: 2 } }]) {
      listener(bad)
    }
    listener({ type: 'browser-agent-result', requestId: 1, ok: false, error: { code: 'C', message: 'm' } })
    await expect(pending).rejects.toMatchObject({ code: 'C' })
    requester.dispose()
  })

  it('times out an unanswered command', async () => {
    vi.useFakeTimers()
    const { transport } = channel()
    transport.send = async () => {}
    const requester = new BrowserAgentRequester(transport)
    const pending = requester.request('session-1', 'snapshot', {}, new AbortController().signal)
    const assertion = expect(pending).rejects.toMatchObject({ code: 'BROWSER_TIMEOUT' })
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    requester.dispose()
  })

  it('rejects on caller cancellation and on disposal', async () => {
    const { transport } = channel()
    transport.send = async () => {}
    const requester = new BrowserAgentRequester(transport)
    const abort = new AbortController()
    const cancelled = requester.request('session-1', 'snapshot', {}, abort.signal)
    abort.abort()
    await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' })
    const disposed = requester.request('session-1', 'snapshot', {}, new AbortController().signal)
    requester.dispose()
    await expect(disposed).rejects.toMatchObject({ code: 'BROWSER_BRIDGE_CLOSED' })
  })

  it('ignores a result for an unknown request and a timer after settlement', async () => {
    vi.useFakeTimers()
    const { transport, listeners } = channel()
    transport.send = async () => {}
    const requester = new BrowserAgentRequester(transport)
    const pending = requester.request('session-1', 'snapshot', {}, new AbortController().signal)
    const listener = [...listeners][0]!
    listener({ type: 'browser-agent-result', requestId: 999, ok: true, text: 'stray' })
    listener({ type: 'browser-agent-result', requestId: 1, ok: true, text: 'settled' })
    await expect(pending).resolves.toBe('settled')
    await vi.advanceTimersByTimeAsync(30_000)
    requester.dispose()
  })

  it('settles a non-Error send rejection and tolerates rejection after cancellation', async () => {
    const { transport } = channel()
    transport.send = async () => { throw 'boom' }
    const requester = new BrowserAgentRequester(transport)
    await expect(requester.request('session-1', 'snapshot', {}, new AbortController().signal))
      .rejects.toThrow('boom')
    const abort = new AbortController()
    const cancelled = requester.request('session-1', 'snapshot', {}, abort.signal)
    abort.abort()
    await expect(cancelled).rejects.toMatchObject({ code: 'ABORTED' })
    await Promise.resolve()
    requester.dispose()
  })

  it('propagates a transport send failure', async () => {
    const { transport } = channel()
    transport.send = async () => { throw new Error('channel down') }
    const requester = new BrowserAgentRequester(transport)
    await expect(requester.request('session-1', 'snapshot', {}, new AbortController().signal))
      .rejects.toThrow('channel down')
    requester.dispose()
  })
})

describe('process transport', () => {
  it('creates the registry when absent and exercises the default IPC transport', async () => {
    const originalSend = process.send
    const originalConnected = process.connected
    const directory = await mkdtemp(join(tmpdir(), 'ocean-desktop-transport-'))
    const ctx = new Context()
    try {
      Object.defineProperty(process, 'connected', { value: false, configurable: true })
      Object.defineProperty(process, 'send', { value: undefined, configurable: true })
      await ctx.plugin(Loader)
      ctx.loader.builtins.include = Include
      Object.assign(ctx.loader.builtins, {
        agents: AgentRegistry, systemPrompt: SystemPrompt, tools: ToolRuntime,
        toolExecutor: NativeToolExecutor, desktop: plugin,
      })
      const config = join(directory, 'cordis.yml')
      await writeFile(config, '- name: cordis:agents\n- name: cordis:systemPrompt\n- name: cordis:tools\n- name: cordis:toolExecutor\n- name: cordis:desktop\n')
      ctx.baseUrl = pathToFileURL(directory).href + '/'
      await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(config).href } })
      await ctx.loader.await()
      for (const entry of ctx.loader.entries()) await entry.fiber?.await()
      expect(ctx.browserUse.providerName).toBe('desktop-sidebar')
      const call = (id: string) => executeToolFixture(ctx, {
        callId: ToolCallId(id), name: 'browser_snapshot', arguments: {},
        signal: new AbortController().signal,
        agent: { session: { header: { id: 'session-1' } } } as never,
      })
      const offline = await call('offline')
      expect(offline.isError).toBe(true)

      const sent: unknown[] = []
      let failNext = false
      Object.defineProperty(process, 'connected', { value: true, configurable: true })
      Object.defineProperty(process, 'send', {
        value: (message: unknown, callback: (error: Error | null) => void) => {
          sent.push(message)
          callback(failNext ? new Error('ipc down') : null)
        },
        configurable: true,
      })
      const online = call('online')
      await vi.waitFor(() => { expect(sent).toHaveLength(1) })
      process.emit('message', { type: 'browser-agent-result', requestId: 2, ok: true, text: 'via ipc' })
      const settled = await online
      expect(settled.isError).toBe(false)
      expect(settled.content).toEqual([{ type: 'text', text: 'via ipc' }])
      failNext = true
      const broken = await call('broken')
      expect(broken.isError).toBe(true)
    } finally {
      await ctx.fiber.dispose()
      await rm(directory, { recursive: true, force: true })
      Object.defineProperty(process, 'send', { value: originalSend, configurable: true })
      Object.defineProperty(process, 'connected', { value: originalConnected, configurable: true })
    }
  })
})
