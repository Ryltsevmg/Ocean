import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertAgentRef,
  assertAgentUrl,
  BrowserAgentError,
  captureBrowserScreenshot,
  executeBrowserAgent,
  isBrowserAgentCommand,
  watchDialogs,
  type GuestLike,
  type GuestRaster,
} from '../src/browser-agent.ts'

interface GuestState {
  readonly title?: string
  readonly url?: string
  readonly loading?: boolean
}

function fakeDebugger() {
  return {
    attach: vi.fn(), isAttached: () => true, detach: vi.fn(),
    on: vi.fn(), removeListener: vi.fn(), sendCommand: vi.fn(async () => {}),
  }
}

function makeRaster(width: number, height: number, png: Buffer): GuestRaster {
  return {
    getSize: () => ({ width, height }),
    resize: options => makeRaster(options.width, 8, png),
    toPNG: () => png,
  }
}

function fakeGuest(overrides: Partial<GuestLike> = {}): GuestLike {
  const noop = (): void => {}
  const base: GuestLike = {
    isDestroyed: () => false,
    getTitle: () => 'Example',
    getURL: () => 'https://example.test/',
    isLoading: () => false,
    executeJavaScript: vi.fn(async (..._args: [string, boolean?]): Promise<unknown> => ({ title: 'Example', url: 'https://example.test/', text: 'button "Save"', truncated: false })),
    sendInputEvent: vi.fn(),
    insertText: vi.fn(async () => {}),
    loadURL: vi.fn(async () => {}),
    reload: noop,
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    navigationHistory: { canGoBack: () => true, canGoForward: () => false, goBack: noop, goForward: noop },
    capturePage: vi.fn(async () => makeRaster(100, 100, Buffer.alloc(8, 7))),
    debugger: fakeDebugger(),
  }
  return { ...base, ...overrides }
}

function guest(state: GuestState = {}) {
  const executeJavaScript = vi.fn(async (..._args: [string, boolean?]): Promise<unknown> => ({ title: 'Example', url: 'https://example.test/', text: 'button "Save"', truncated: false }))
  const sendInputEvent = vi.fn()
  const contents = fakeGuest({
    getTitle: () => state.title ?? 'Example',
    getURL: () => state.url ?? 'https://example.test/',
    isLoading: () => state.loading ?? false,
    executeJavaScript,
    sendInputEvent,
  })
  return { contents, executeJavaScript, sendInputEvent }
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('browser agent protocol', () => {
  it('admits only complete commands with finite JSON arguments', () => {
    expect(isBrowserAgentCommand({ type: 'browser-agent-command', requestId: 1, sessionId: 'session',
      method: 'snapshot', args: {} })).toBe(true)
    expect(isBrowserAgentCommand({ type: 'browser-agent-command', requestId: -1, sessionId: 'session',
      method: 'snapshot', args: {} })).toBe(false)
    expect(isBrowserAgentCommand({ type: 'browser-agent-command', requestId: 1, sessionId: '',
      method: 'snapshot', args: {} })).toBe(false)
    expect(isBrowserAgentCommand({ type: 'browser-agent-command', requestId: 1, sessionId: 'session',
      method: 'other', args: {} })).toBe(false)
    expect(isBrowserAgentCommand({ type: 'browser-agent-command', requestId: 1, sessionId: 'session',
      method: 'click', args: { ref: Number.POSITIVE_INFINITY } })).toBe(false)
  })

  it('validates addresses and element references', () => {
    expect(assertAgentUrl('https://example.test/path')).toBe('https://example.test/path')
    expect(assertAgentUrl('http://localhost:3000/')).toBe('http://localhost:3000/')
    expect(() => assertAgentUrl('file:///etc/passwd')).toThrow(BrowserAgentError)
    expect(() => assertAgentUrl('https://user:pass@example.test/')).toThrow(BrowserAgentError)
    expect(assertAgentRef('e12')).toBe('e12')
    expect(() => assertAgentRef('button')).toThrow(BrowserAgentError)
  })
})

describe('browser agent executor', () => {
  it('reports tab facts without reading page content', async () => {
    const { contents } = guest({ title: 'Title', url: 'https://example.test/next', loading: true })
    await expect(executeBrowserAgent(contents, 'info', {})).resolves.toBe(
      'title: Title\nurl: https://example.test/next\nloading: true')
  })

  it('returns the bounded semantic snapshot', async () => {
    const { contents } = guest()
    await expect(executeBrowserAgent(contents, 'snapshot', {})).resolves.toContain('button "Save"')
  })

  it('clicks a snapshot ref with native input and reads the result', async () => {
    vi.useFakeTimers()
    const { contents, executeJavaScript, sendInputEvent } = guest()
    executeJavaScript.mockResolvedValueOnce({ ok: true, x: 10, y: 20 }).mockResolvedValueOnce(
      { title: 'Example', url: 'https://example.test/', text: 'link "Next"', truncated: false })
    const pending = executeBrowserAgent(contents, 'click', { ref: 'e4' })
    await vi.advanceTimersByTimeAsync(600)
    await expect(pending).resolves.toContain('link "Next"')
    expect(sendInputEvent).toHaveBeenCalledTimes(3)
  })

  it('refuses a sensitive field and reports a stale ref', async () => {
    const { contents: sensitive, executeJavaScript: sensitiveExecute } = guest()
    sensitiveExecute.mockResolvedValueOnce({ ok: false, reason: 'sensitive' })
    await expect(executeBrowserAgent(sensitive, 'fill', { ref: 'e1', text: 'secret' }))
      .rejects.toMatchObject({ code: 'BROWSER_SECRET_FIELD' })

    const { contents: missing, executeJavaScript: missingExecute } = guest()
    missingExecute.mockResolvedValueOnce({ ok: false, reason: 'missing' })
    await expect(executeBrowserAgent(missing, 'click', { ref: 'e9' }))
      .rejects.toMatchObject({ code: 'BROWSER_REF_STALE' })
  })

  it('presses a supported key with modifiers and refuses unknown keys', async () => {
    const { contents, sendInputEvent } = guest()
    await executeBrowserAgent(contents, 'press_key', { key: 'Enter', modifiers: 'shift,control' })
    expect(sendInputEvent).toHaveBeenCalledTimes(2)
    await expect(executeBrowserAgent(contents, 'press_key', { key: 'F5' })).rejects.toMatchObject({ code: 'BROWSER_KEY_UNSUPPORTED' })
    await expect(executeBrowserAgent(contents, 'press_key', { key: 'Tab', modifiers: 'hyper' })).rejects.toMatchObject({ code: 'BROWSER_MODIFIERS_INVALID' })
  })

  it('scrolls the viewport or one element and reports a stale ref', async () => {
    const { contents, executeJavaScript } = guest()
    await executeBrowserAgent(contents, 'scroll', { deltaY: 500 })
    expect(executeJavaScript.mock.calls[0]![0]).toContain('window.scrollBy(0, 500)')
    await executeBrowserAgent(contents, 'scroll', { ref: 'e1', deltaX: -20 })
    expect(executeJavaScript.mock.calls[2]![0]).toContain('scrollBy(-20, 0)')
    executeJavaScript.mockResolvedValueOnce(false)
    await expect(executeBrowserAgent(contents, 'scroll', { ref: 'e9' })).rejects.toMatchObject({ code: 'BROWSER_REF_STALE' })
  })

  it('selects an option and refuses unsupported controls or missing options', async () => {
    const { contents, executeJavaScript } = guest()
    executeJavaScript.mockResolvedValueOnce('ok')
    await executeBrowserAgent(contents, 'select', { ref: 'e1', value: 'b' })
    executeJavaScript.mockResolvedValueOnce('unsupported')
    await expect(executeBrowserAgent(contents, 'select', { ref: 'e1', value: 'b' })).rejects.toMatchObject({ code: 'BROWSER_SELECT_UNSUPPORTED' })
    executeJavaScript.mockResolvedValueOnce('missing')
    await expect(executeBrowserAgent(contents, 'select', { ref: 'e1', value: 'b' })).rejects.toMatchObject({ code: 'BROWSER_OPTION_MISSING' })
  })

  it('checks a box and reports unsupported, stale, or blocked controls', async () => {
    const { contents, executeJavaScript } = guest()
    executeJavaScript.mockResolvedValueOnce('ok')
    await executeBrowserAgent(contents, 'check', { ref: 'e1', checked: 'true' })
    for (const [outcome, code] of [['unsupported', 'BROWSER_CHECK_UNSUPPORTED'], ['missing', 'BROWSER_REF_STALE'], ['blocked', 'BROWSER_CHECK_BLOCKED']] as const) {
      executeJavaScript.mockResolvedValueOnce(outcome)
      await expect(executeBrowserAgent(contents, 'check', { ref: 'e1', checked: 'true' })).rejects.toMatchObject({ code })
    }
  })
})

describe('browser screenshot capture', () => {
  function raster(width: number, bytes: number) {
    const png = Buffer.alloc(bytes, 7)
    const resize = vi.fn(() => makeRaster(64, 8, png))
    return Object.assign(makeRaster(width, 100, png), { resize })
  }

  it('returns the viewport raster without downscaling when it fits', async () => {
    const image = raster(100, 32)
    const out = await captureBrowserScreenshot(fakeGuest({ capturePage: vi.fn(async () => image) }), {})
    expect(out.text).toBe('screenshot 100x100')
    expect(out.image.width).toBe(100)
    expect(image.resize).not.toHaveBeenCalled()
  })

  it('downscales wide pages and clamps the requested bounds', async () => {
    const image = raster(4000, 16)
    const out = await captureBrowserScreenshot(fakeGuest({ capturePage: vi.fn(async () => image) }), { maxWidth: 10, maxBytes: 1 })
    expect(out.image.width).toBe(64)
    expect(image.resize).toHaveBeenCalledWith({ width: 64 })
  })

  it('refuses an oversized raster and a closed guest', async () => {
    await expect(captureBrowserScreenshot(fakeGuest({ capturePage: vi.fn(async () => raster(100, 2048)) }), { maxBytes: 1024 }))
      .rejects.toMatchObject({ code: 'BROWSER_SCREENSHOT_TOO_LARGE' })
    await expect(captureBrowserScreenshot(fakeGuest({ isDestroyed: () => true }), {}))
      .rejects.toMatchObject({ code: 'BROWSER_GUEST_CLOSED' })
  })
})

describe('dialog watch', () => {
  function debuggerGuest(attachThrows = false) {
    const listeners: ((...args: unknown[]) => void)[] = []
    const sendCommand = vi.fn(async () => {})
    const contents = fakeGuest({
      debugger: {
        attach: () => { if (attachThrows) throw new Error('busy') },
        isAttached: () => !attachThrows,
        detach: vi.fn(),
        on: (_event, listener) => { listeners.push(listener as (...args: unknown[]) => void) },
        removeListener: vi.fn(),
        sendCommand,
      },
    })
    return { contents, listeners, sendCommand }
  }

  it('observes, answers, and clears a pending dialog', async () => {
    const { contents, listeners, sendCommand } = debuggerGuest()
    const watch = watchDialogs(contents)
    expect(watch.pending()).toBeUndefined()
    listeners[0]!({}, 'Page.javascriptDialogOpening', { type: 'confirm', message: 'Delete?', defaultPrompt: '' })
    expect(watch.pending()).toMatchObject({ type: 'confirm', message: 'Delete?' })
    await watch.answer('accept', 'yes')
    expect(sendCommand).toHaveBeenCalledWith('Page.handleJavaScriptDialog', { accept: true, promptText: 'yes' })
    expect(watch.pending()).toBeUndefined()
    listeners[0]!({}, 'Page.javascriptDialogOpening', { type: 'alert', message: 'Hi' })
    listeners[0]!({}, 'Page.javascriptDialogClosed', {})
    expect(watch.pending()).toBeUndefined()
    await expect(watch.answer('dismiss')).rejects.toMatchObject({ code: 'BROWSER_DIALOG_NONE' })
    watch.dispose()
  })

  it('stays inert when another debugger owns the guest', async () => {
    const { contents } = debuggerGuest(true)
    const watch = watchDialogs(contents)
    await expect(watch.answer('accept')).rejects.toMatchObject({ code: 'BROWSER_DIALOG_UNAVAILABLE' })
    watch.dispose()
  })
})

describe('dev watch console and network', () => {
  function eventGuest() {
    const listeners: ((...args: unknown[]) => void)[] = []
    const sendCommand = vi.fn(async () => {})
    const contents = fakeGuest({
      debugger: {
        attach: vi.fn(), isAttached: () => true, detach: vi.fn(),
        on: (_event, listener) => { listeners.push(listener as (...args: unknown[]) => void) },
        removeListener: vi.fn(), sendCommand,
      },
    })
    return { contents, listeners }
  }

  it('buffers console output and network requests with bounds', async () => {
    const { contents, listeners } = eventGuest()
    const watch = watchDialogs(contents)
    expect(watch.console()).toBe('no console output')
    expect(watch.network()).toBe('no network requests')
    const emit = (method: string, params: object): void => { for (const l of [...listeners]) l({}, method, params) }
    emit('Runtime.consoleAPICalled', { type: 'warning', args: [{ value: 'slow' }, { description: 'Resource' }] })
    emit('Network.requestWillBeSent', { requestId: 'r1', request: { method: 'POST', url: 'https://api.test/x' } })
    emit('Network.responseReceived', { requestId: 'r1', response: { status: 201 } })
    emit('Network.requestWillBeSent', { requestId: 'r2', request: { url: 'https://api.test/y' } })
    emit('Network.loadingFailed', { requestId: 'r2' })
    expect(watch.console()).toContain('warning slow Resource')
    expect(watch.network()).toContain('POST 201 https://api.test/x')
    expect(watch.network()).toContain('GET failed https://api.test/y')
    for (let index = 0; index < 70; index++) emit('Runtime.consoleAPICalled', { type: 'log', args: [{ value: index }] })
    expect(watch.console().split('\n')).toHaveLength(61)
    watch.dispose()
  })
})

describe('browser upload', () => {
  function chooserGuest(chooserOpens = true) {
    const listeners: ((...args: unknown[]) => void)[] = []
    const sendCommand = vi.fn(async (method: string) => {
      if (method === 'Page.setInterceptFileChooserDialog' && chooserOpens) {
        setTimeout(() => { for (const l of listeners) l({}, 'Page.fileChooserOpened', { backendNodeId: 42 }) }, 10)
      }
    })
    const contents = fakeGuest({
      executeJavaScript: vi.fn(async (): Promise<unknown> => ({ ok: true, x: 5, y: 5 })),
      debugger: {
        attach: vi.fn(), isAttached: () => true, detach: vi.fn(),
        on: (_event, listener) => { listeners.push(listener as (...args: unknown[]) => void) },
        removeListener: vi.fn(), sendCommand,
      },
    })
    return { contents, sendCommand }
  }

  it('intercepts the chooser and answers with the file', async () => {
    const { contents, sendCommand } = chooserGuest()
    const file = join(tmpdir(), `ocean-upload-${String(Date.now())}.pdf`)
    await writeFile(file, 'pdf')
    await executeBrowserAgent(contents, 'upload', { ref: 'e1', path: file })
    expect(sendCommand).toHaveBeenCalledWith('DOM.setFileInputFiles', { files: [file], backendNodeId: 42 })
    await rm(file, { force: true })
  })

  it('refuses a missing file', async () => {
    const { contents } = chooserGuest()
    await expect(executeBrowserAgent(contents, 'upload', { ref: 'e1', path: '/tmp/ocean-upload-none' }))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_FILE_MISSING' })
  })

  it('refuses a chooser that never opens', async () => {
    const { contents } = chooserGuest(false)
    const real = join(tmpdir(), `ocean-upload-stuck-${String(Date.now())}.pdf`)
    await writeFile(real, 'pdf')
    await expect(executeBrowserAgent(contents, 'upload', { ref: 'e1', path: real }))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NO_CHOOSER' })
    await rm(real, { force: true })
  }, 10_000)
})
