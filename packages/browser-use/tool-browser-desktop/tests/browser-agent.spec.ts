import { describe, expect, it, vi } from 'vitest'
import type { ToolDefinition } from '@ocean/ocean-tools'
import type { ToolRunContext } from '@ocean/ocean-tools'
import type { BrowserAgentCommand } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'
import {
  BrowserAgentRequester,
  installDesktopBrowserAgent,
  type DesktopBrowserTransport,
} from '../src/index.ts'

function transport() {
  const listeners = new Set<(message: unknown) => void>()
  const commands: BrowserAgentCommand[] = []
  const value: DesktopBrowserTransport = {
    send: vi.fn(async (command: BrowserAgentCommand) => {
      commands.push(command)
      for (const listener of listeners) {
        listener({ type: 'browser-agent-result', requestId: command.requestId, ok: true, text: 'button "Save"' })
      }
    }),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return { value, commands, listeners }
}

function execution(): ToolRunContext {
  return {
    callId: 'call' as never,
    rootCallId: 'call' as never,
    token: 'token' as never,
    name: 'browser_snapshot',
    arguments: {},
    agent: { session: { header: { id: 'session-1' } } } as never,
    signal: new AbortController().signal,
    deferContext: vi.fn(),
    concludeTurn: vi.fn(),
  }
}

function fakeContext(providerName?: string) {
  const registered = new Map<string, ToolDefinition>()
  const sections: unknown[] = []
  const cleanups: unknown[] = []
  const browserUse = {
    providerName,
    register: vi.fn((name: string) => {
      expect(name).toBe('desktop-sidebar')
      return async () => {}
    }),
  }
  const ctx = {
    get: vi.fn((name: string) => name === 'browserUse' ? browserUse : undefined),
    browserUse,
    systemPrompt: {
      section: vi.fn((section: unknown) => { sections.push(section); return () => {} }),
      getSectionOrder: vi.fn(() => 0),
    },
    tools: {
      register: vi.fn((tool: ToolDefinition) => { registered.set(tool.name, tool); return () => {} }),
    },
    logger: { warn: vi.fn() },
    effect: vi.fn((factory: () => Generator) => {
      const iterator = factory()
      let next = iterator.next()
      while (next.done !== true) {
        cleanups.push(next.value)
        next = iterator.next()
      }
      return () => {}
    }),
  }
  return { ctx, registered, sections, cleanups }
}

describe('desktop browser tools', () => {
  it('registers one provider, the policy section, and every browser tool', () => {
    const fake = fakeContext()
    installDesktopBrowserAgent(fake.ctx as never, transport().value)
    expect(fake.ctx.browserUse.register).toHaveBeenCalledOnce()
    expect(fake.sections).toHaveLength(1)
    expect([...fake.registered.keys()]).toEqual([
      'browser_info', 'browser_snapshot', 'browser_navigate', 'browser_click', 'browser_fill',
      'browser_back', 'browser_forward', 'browser_reload', 'browser_screenshot',
      'browser_press_key', 'browser_scroll', 'browser_select', 'browser_check', 'browser_dialog',
      'browser_tabs', 'browser_tab_select',
    ])
  })

  it('keeps its tools when another browser provider already owns the slot', () => {
    const fake = fakeContext('chrome')
    installDesktopBrowserAgent(fake.ctx as never, transport().value)
    expect(fake.registered.size).toBe(16)
    expect(fake.ctx.browserUse.register).not.toHaveBeenCalled()
    expect(fake.ctx.logger.warn).toHaveBeenCalledOnce()
  })

  it('sends the Session identity and returns the main-process text', async () => {
    const channel = transport()
    const fake = fakeContext()
    installDesktopBrowserAgent(fake.ctx as never, channel.value)
    const tool = fake.registered.get('browser_snapshot')!
    await expect(tool.execute({}, execution())).resolves.toEqual({ text: 'button "Save"' })
    expect(channel.commands).toEqual([{ type: 'browser-agent-command', requestId: 1, sessionId: 'session-1',
      method: 'snapshot', args: {} }])
  })

  it('propagates a typed main-process failure', async () => {
    const channel = transport()
    channel.value.send = vi.fn(async (command: BrowserAgentCommand) => {
      for (const listener of channel.listeners) {
        listener({ type: 'browser-agent-result', requestId: command.requestId, ok: false,
          error: { code: 'BROWSER_NOT_SHARED', message: 'No shared tab.' } })
      }
    })
    const fake = fakeContext()
    installDesktopBrowserAgent(fake.ctx as never, channel.value)
    const tool = fake.registered.get('browser_snapshot')!
    await expect(tool.execute({}, execution())).rejects.toMatchObject({ code: 'BROWSER_NOT_SHARED', message: 'No shared tab.' })
  })

  it('rejects a request after the caller aborts', async () => {
    const channel = transport()
    const requester = new BrowserAgentRequester(channel.value)
    const abort = new AbortController()
    abort.abort()
    await expect(requester.request('session-1', 'snapshot', {}, abort.signal)).rejects.toMatchObject({ code: 'ABORTED' })
    requester.dispose()
  })
})
