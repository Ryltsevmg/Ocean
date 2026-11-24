/** Branch coverage for the Desktop browser Host bridge and tool bodies. */
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@ocean/ocean-agent'
import BrowserUseRegistry from '@ocean/ocean-browser-use'
import SystemPrompt from '@ocean/ocean-system-prompt'
import ToolRuntime from '@ocean/ocean-tools'
import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { executeToolFixture } from '@ocean/ocean-tool-testkit'
import { ToolCallId } from '@ocean/ocean-llm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolDefinition, ToolRunContext } from '@ocean/ocean-tools'
import type { BrowserAgentCommand } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'
import * as plugin from '../src/install.ts'
import { installDesktopBrowserAgent } from '../src/install.ts'
import { BrowserAgentRequester, type DesktopBrowserTransport } from '../src/bridge.ts'

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

function fakeContext(providerName?: string, options: { attachments?: boolean; emptyStore?: boolean; approval?: 'allowed-once' | 'rejected' | 'policy-denied' | 'absent' } = {}) {
  const registered = new Map<string, ToolDefinition>()
  const saveImages = vi.fn(async (inputs: { data: Uint8Array }[]) => options.emptyStore
    ? []
    : inputs.map(input => ({ attachmentId: 'att-1', mediaType: 'image/png' as const, bytes: input.data.byteLength, width: 10, height: 10 })))
  const attachments = options.attachments === false ? undefined : { saveImages }
  const approvalRequest = vi.fn(async (_request: { readonly toolName: string }) => {
    if (options.approval === 'rejected') return { outcome: 'rejected' as const, deniedBy: 'answerer' as const }
    if (options.approval === 'policy-denied') return { outcome: 'rejected' as const, deniedBy: 'policy' as const }
    return { outcome: options.approval ?? 'allowed-once' }
  })
  const approval = options.approval === 'absent' ? undefined : { request: approvalRequest }
  const browserUse = {
    providerName,
    register: vi.fn(() => async () => {}),
  }
  const ctx = {
    get: vi.fn((name: string) => name === 'browserUse' ? browserUse : name === 'attachments' ? attachments : name === 'approval' ? approval : undefined),
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
  return { ctx, registered, saveImages, approvalRequest }
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
    await expect(pending).resolves.toMatchObject({ text: 'settled' })
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
  it('uses the shared registry and exercises the default IPC transport', async () => {
    const originalSend = Object.getOwnPropertyDescriptor(process, 'send')?.value as typeof process.send
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
        toolExecutor: NativeToolExecutor, browserUse: BrowserUseRegistry, desktop: plugin,
      })
      const config = join(directory, 'cordis.yml')
      await writeFile(config, '- name: cordis:agents\n- name: cordis:systemPrompt\n- name: cordis:tools\n- name: cordis:toolExecutor\n- name: cordis:browserUse\n- name: cordis:desktop\n')
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
      for (const listener of process.listeners('message')) listener({ type: 'browser-agent-result', requestId: 2, ok: true, text: 'via ipc' }, undefined)
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

describe('browser_screenshot', () => {
  const image = { data: Buffer.from([1, 2, 3]).toString('base64'), mediaType: 'image/png' as const, width: 10, height: 10 }
  function screenshotChannel(withImage = true) {
    const channel0 = channel()
    channel0.transport.send = async (command) => {
      channel0.commands.push(command)
      for (const listener of channel0.listeners) {
        listener({ type: 'browser-agent-result', requestId: command.requestId, ok: true, text: 'screenshot 10x10',
          ...withImage ? { image } : {} })
      }
    }
    return channel0
  }

  it('stores the raster durably and renders an image block', async () => {
    const { ctx, registered, saveImages } = fakeContext()
    const ch = screenshotChannel()
    installDesktopBrowserAgent(ctx as never, ch.transport)
    const tool = registered.get('browser_screenshot')!
    const value = await tool.execute({}, execution()) as {
      attachment: {
        attachmentId: string
        mediaType: string
        bytes: number
        width: number
        height: number
      }
      width: number
      height: number
    }
    expect(value.attachment.attachmentId).toBe('att-1')
    expect(saveImages).toHaveBeenCalledOnce()
    expect(saveImages.mock.calls[0]![0][0]!.data).toBeInstanceOf(Uint8Array)
    expect(ch.commands[0]!.args).toMatchObject({ maxWidth: 1280, maxBytes: 4_000_000 })
    const blocks = tool.output.render({}, value) as { type: string; attachment: { attachmentId: string } }[]
    expect(blocks[0]!.type).toBe('image')
    expect(blocks[0]!.attachment.attachmentId).toBe('att-1')
    expect(tool.presentCall?.({})).toBeDefined()
  })

  it('honours configured bounds and refuses missing storage or image', async () => {
    const bounded = fakeContext()
    const ch = screenshotChannel()
    installDesktopBrowserAgent(bounded.ctx as never, ch.transport, { screenshotMaxWidth: 200, screenshotMaxBytes: 2048 })
    await bounded.registered.get('browser_screenshot')!.execute({}, execution())
    expect(ch.commands[0]!.args).toMatchObject({ maxWidth: 200, maxBytes: 2048 })

    const noImage = fakeContext()
    installDesktopBrowserAgent(noImage.ctx as never, screenshotChannel(false).transport)
    await expect(noImage.registered.get('browser_screenshot')!.execute({}, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_SCREENSHOT_MISSING' })

    const noStore = fakeContext(undefined, { attachments: false })
    installDesktopBrowserAgent(noStore.ctx as never, screenshotChannel().transport)
    await expect(noStore.registered.get('browser_screenshot')!.execute({}, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_ATTACHMENTS_UNAVAILABLE' })

    const empty = fakeContext(undefined, { emptyStore: true })
    installDesktopBrowserAgent(empty.ctx as never, screenshotChannel().transport)
    await expect(empty.registered.get('browser_screenshot')!.execute({}, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_SCREENSHOT_MISSING' })
  })

  it('ignores results whose image payload is malformed', async () => {
    const { transport, listeners } = channel()
    transport.send = async () => {}
    const requester = new BrowserAgentRequester(transport)
    const pending = requester.request('session-1', 'screenshot', {}, new AbortController().signal)
    const listener = [...listeners][0]!
    for (const badImage of [{ data: 1, mediaType: 'image/png', width: 1, height: 1 },
      { data: 'x', mediaType: 'image/jpeg', width: 1, height: 1 },
      { data: 'x', mediaType: 'image/png', width: 1.5, height: 1 },
      { data: 'x', mediaType: 'image/png', width: 1, height: '2' }]) {
      listener({ type: 'browser-agent-result', requestId: 1, ok: true, text: 't', image: badImage })
    }
    listener({ type: 'browser-agent-result', requestId: 1, ok: true, text: 't', image })
    await expect(pending).resolves.toMatchObject({ text: 't', image: { width: 10 } })
    requester.dispose()
  })
})

describe('input tools and enforced confirmation', () => {
  it('executes the input and dialog tools and presents their calls', async () => {
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport)
    const args: Record<string, Record<string, string | number>> = {
      browser_press_key: { key: 'Enter' }, browser_scroll: { deltaY: 100 },
      browser_select: { ref: 'e1', value: 'b' }, browser_check: { ref: 'e1', checked: 'true' },
      browser_dialog: { action: 'accept' },
      browser_tabs: {},
      browser_tab_select: { index: 0 },
      browser_console: {},
      browser_network: {},
      browser_handoff: { message: 'log in' },
    }
    for (const [name, toolArgs] of Object.entries(args)) {
      const tool = registered.get(name)!
      await expect(tool.execute(toolArgs, execution())).resolves.toEqual({ text: 'ok' })
      expect(tool.presentCall?.(toolArgs)).toBeDefined()
    }
  })

  it('asks the person before mutating actions when confirmActions is on', async () => {
    const granted = fakeContext(undefined, { approval: 'allowed-once' })
    installDesktopBrowserAgent(granted.ctx as never, channel().transport, { confirmActions: true })
    await granted.registered.get('browser_click')!.execute({ ref: 'e1' }, execution())
    expect(granted.approvalRequest).toHaveBeenCalledOnce()
    expect(granted.approvalRequest.mock.calls[0]![0]).toMatchObject({ toolName: 'browser_click' })

    const read = fakeContext(undefined, { approval: 'allowed-once' })
    installDesktopBrowserAgent(read.ctx as never, channel().transport, { confirmActions: true })
    await read.registered.get('browser_dialog')!.execute({ action: 'read' }, execution())
    expect(read.approvalRequest).not.toHaveBeenCalled()

    const readOnly = fakeContext(undefined, { approval: 'allowed-once' })
    installDesktopBrowserAgent(readOnly.ctx as never, channel().transport, { confirmActions: true })
    await readOnly.registered.get('browser_snapshot')!.execute({}, execution())
    expect(readOnly.approvalRequest).not.toHaveBeenCalled()

    const dialogAccept = fakeContext(undefined, { approval: 'allowed-once' })
    installDesktopBrowserAgent(dialogAccept.ctx as never, channel().transport, { confirmActions: true })
    await dialogAccept.registered.get('browser_dialog')!.execute({ action: 'accept' }, execution())
    expect(dialogAccept.approvalRequest).toHaveBeenCalledOnce()

    const off = fakeContext(undefined, { approval: 'allowed-once' })
    installDesktopBrowserAgent(off.ctx as never, channel().transport)
    await off.registered.get('browser_click')!.execute({ ref: 'e1' }, execution())
    expect(off.approvalRequest).not.toHaveBeenCalled()
  })

  it('refuses mutating actions when the person declines or approval is unavailable', async () => {
    const declined = fakeContext(undefined, { approval: 'rejected' })
    installDesktopBrowserAgent(declined.ctx as never, channel().transport, { confirmActions: true })
    await expect(declined.registered.get('browser_click')!.execute({ ref: 'e1' }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_ACTION_DENIED' })

    const absent = fakeContext(undefined, { approval: 'absent' })
    installDesktopBrowserAgent(absent.ctx as never, channel().transport, { confirmActions: true })
    await expect(absent.registered.get('browser_fill')!.execute({ ref: 'e1', text: 'x' }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_APPROVAL_UNAVAILABLE' })
  })

  it('does not blame the person when a never policy rejected the ask', async () => {
    const disabled = fakeContext(undefined, { approval: 'policy-denied' })
    installDesktopBrowserAgent(disabled.ctx as never, channel().transport, { confirmActions: true })
    await expect(disabled.registered.get('browser_click')!.execute({ ref: 'e1' }, execution()))
      .rejects.toMatchObject({
        code: 'BROWSER_APPROVAL_UNAVAILABLE',
        message: 'Approval prompts are disabled in this session, so this browser action was not performed.',
      })
  })
})

describe('downloads and upload allowlist', () => {
  it('lists downloads through the tool', async () => {
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport)
    const tool = registered.get('browser_downloads')!
    await expect(tool.execute({}, execution())).resolves.toEqual({ text: 'ok' })
    expect(tool.presentCall?.({})).toBeDefined()
  })

  it('accepts a file inside a real root and refuses one outside it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-upload-roots-'))
    const inside = join(root, 'allowed', 'deep')
    await mkdir(inside, { recursive: true })
    const file = join(inside, 'cv.pdf')
    await writeFile(file, 'pdf')
    const outside = join(root, 'outside.pdf')
    await writeFile(outside, 'pdf')
    const { ctx, registered } = fakeContext()
    const ch = channel()
    installDesktopBrowserAgent(ctx as never, ch.transport, { uploadAllowedRoots: [join(root, 'allowed')] })
    const tool = registered.get('browser_upload')!
    await expect(tool.execute({ ref: 'e1', path: outside }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NOT_ALLOWED' })
    await expect(tool.execute({ ref: 'e1', path: file }, execution())).resolves.toEqual({ text: 'ok' })
    expect(tool.presentCall?.({ ref: 'e1', path: file })).toBeDefined()
    expect(ch.commands.at(-1)!.args).toMatchObject({ ref: 'e1', path: file })
    // A directory is not a file the Agent may hand to a page.
    await expect(tool.execute({ ref: 'e1', path: inside }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NOT_ALLOWED' })
    // A path that does not exist cannot be resolved, so it fails closed.
    await expect(tool.execute({ ref: 'e1', path: join(inside, 'gone.pdf') }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NOT_ALLOWED' })
    await rm(root, { recursive: true, force: true })
  })

  it('skips a root that no longer exists and still uses a live one', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-upload-stale-'))
    const live = join(root, 'live')
    await mkdir(live, { recursive: true })
    const file = join(live, 'cv.pdf')
    await writeFile(file, 'pdf')
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport, {
      uploadAllowedRoots: [join(root, 'deleted-root'), live],
    })
    await expect(registered.get('browser_upload')!.execute({ ref: 'e1', path: file }, execution()))
      .resolves.toEqual({ text: 'ok' })
    await rm(root, { recursive: true, force: true })
  })

  it.runIf(process.platform !== 'win32')('refuses a symlink that leaves an allowed root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-upload-link-'))
    const allowed = join(root, 'allowed')
    await mkdir(allowed, { recursive: true })
    const secret = join(root, 'secret.pem')
    await writeFile(secret, 'key')
    const link = join(allowed, 'looks-inside.pdf')
    await symlink(secret, link)
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport, { uploadAllowedRoots: [allowed] })
    await expect(registered.get('browser_upload')!.execute({ ref: 'e1', path: link }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NOT_ALLOWED' })
    await rm(root, { recursive: true, force: true })
  })

  it('refuses every upload when no roots are configured', async () => {
    const { ctx, registered } = fakeContext()
    installDesktopBrowserAgent(ctx as never, channel().transport)
    await expect(registered.get('browser_upload')!.execute({ ref: 'e1', path: '/tmp/x.pdf' }, execution()))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NOT_ALLOWED' })
  })
})
