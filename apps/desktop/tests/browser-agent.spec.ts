import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import {
  assertAgentRef,
  assertAgentUrl,
  BrowserAgentError,
  captureBrowserScreenshot,
  executeBrowserAgent,
  watchDialogs,
  isBrowserAgentCommand,
} from '../src/browser-agent.ts'

interface GuestState {
  readonly title?: string
  readonly url?: string
  readonly loading?: boolean
}

function guest(state: GuestState = {}) {
  const executeJavaScript = vi.fn(async (): Promise<unknown> => ({ title: 'Example', url: 'https://example.test/', text: 'button "Save"', truncated: false }))
  const sendInputEvent = vi.fn()
  const contents = {
    isDestroyed: () => false,
    getTitle: () => state.title ?? 'Example',
    getURL: () => state.url ?? 'https://example.test/',
    isLoading: () => state.loading ?? false,
    executeJavaScript,
    sendInputEvent,
    insertText: vi.fn(async () => {}),
    loadURL: vi.fn(async () => {}),
    reload: vi.fn(),
    on: vi.fn(), removeListener: vi.fn(), once: vi.fn(),
    navigationHistory: { canGoBack: () => true, canGoForward: () => false, goBack: vi.fn(), goForward: vi.fn() },
  } as unknown as WebContents
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
    const { contents, executeJavaScript } = guest({ title: 'Title', url: 'https://example.test/next', loading: true })
    await expect(executeBrowserAgent(contents, 'info', {})).resolves.toBe(
      'title: Title\nurl: https://example.test/next\nloading: true')
    expect(executeJavaScript).not.toHaveBeenCalled()
  })

  it('returns the bounded semantic snapshot', async () => {
    const { contents, executeJavaScript } = guest()
    await expect(executeBrowserAgent(contents, 'snapshot', {})).resolves.toContain('button "Save"')
    expect(executeJavaScript).toHaveBeenCalledOnce()
  })

  it('clicks a snapshot ref with native input and reads the result', async () => {
    vi.useFakeTimers()
    const { contents, executeJavaScript, sendInputEvent } = guest()
    const execute = vi.mocked(executeJavaScript)
    execute.mockResolvedValueOnce({ ok: true, x: 10, y: 20 }).mockResolvedValueOnce(
      { title: 'Example', url: 'https://example.test/', text: 'link "Next"', truncated: false })
    const pending = executeBrowserAgent(contents, 'click', { ref: 'e4' })
    await vi.advanceTimersByTimeAsync(600)
    await expect(pending).resolves.toContain('link "Next"')
    expect(sendInputEvent).toHaveBeenCalledTimes(3)
    expect(sendInputEvent).toHaveBeenNthCalledWith(1, { type: 'mouseMove', x: 10, y: 20 })
  })

  it('refuses a sensitive field and reports a stale ref', async () => {
    const { contents: sensitive, executeJavaScript: sensitiveExecute } = guest()
    vi.mocked(sensitiveExecute).mockResolvedValueOnce({ ok: false, reason: 'sensitive' })
    await expect(executeBrowserAgent(sensitive, 'fill', { ref: 'e1', text: 'secret' }))
      .rejects.toMatchObject({ code: 'BROWSER_SECRET_FIELD' })

    const { contents: missing, executeJavaScript: missingExecute } = guest()
    vi.mocked(missingExecute).mockResolvedValueOnce({ ok: false, reason: 'missing' })
    await expect(executeBrowserAgent(missing, 'click', { ref: 'e9' }))
      .rejects.toMatchObject({ code: 'BROWSER_REF_STALE' })
  })
})

describe('browser screenshot capture', () => {
  function raster(width: number, bytes: number) {
    const png = Buffer.alloc(bytes, 7)
    const image = {
      getSize: () => ({ width, height: 100 }),
      resize: vi.fn(() => ({ getSize: () => ({ width: 64, height: 8 }), toPNG: () => png })),
      toPNG: () => png,
    }
    return image
  }
  function guestWith(image: unknown, destroyed = false) {
    return { isDestroyed: () => destroyed, capturePage: vi.fn(async () => image) } as never
  }

  it('returns the viewport raster without downscaling when it fits', async () => {
    const image = raster(100, 32)
    const out = await captureBrowserScreenshot(guestWith(image), {})
    expect(out.text).toBe('screenshot 100x100')
    expect(out.image).toMatchObject({ mediaType: 'image/png', width: 100, height: 100 })
    expect(out.image.data).toBe(Buffer.alloc(32, 7).toString('base64'))
    expect(image.resize).not.toHaveBeenCalled()
  })

  it('downscales wide pages and clamps the requested bounds', async () => {
    const image = raster(4000, 16)
    const out = await captureBrowserScreenshot(guestWith(image), { maxWidth: 10, maxBytes: 1 })
    expect(image.resize).toHaveBeenCalledWith({ width: 64 })
    expect(out.image.width).toBe(64)
  })

  it('refuses an oversized raster and a closed guest', async () => {
    await expect(captureBrowserScreenshot(guestWith(raster(100, 2048)), { maxBytes: 1024 }))
      .rejects.toMatchObject({ code: 'BROWSER_SCREENSHOT_TOO_LARGE' })
    await expect(captureBrowserScreenshot(guestWith(raster(100, 8), true), {}))
      .rejects.toMatchObject({ code: 'BROWSER_GUEST_CLOSED' })
  })
})

describe('browser input primitives', () => {
  function guest() {
    const sendInputEvent = vi.fn()
    const executeJavaScript = vi.fn(async (..._args: [string, boolean?]): Promise<unknown> => true)
    const contents = {
      isDestroyed: () => false, getTitle: () => 'T', getURL: () => 'https://example.test/', isLoading: () => false,
      sendInputEvent, executeJavaScript, insertText: vi.fn(async () => {}), loadURL: vi.fn(async () => {}), reload: vi.fn(),
      on: vi.fn(), removeListener: vi.fn(), once: vi.fn(),
      navigationHistory: { canGoBack: () => false, canGoForward: () => false, goBack: vi.fn(), goForward: vi.fn() },
    } as never
    return { contents, sendInputEvent, executeJavaScript }
  }

  it('presses a supported key with modifiers and refuses unknown keys', async () => {
    const { contents, sendInputEvent } = guest()
    await executeBrowserAgent(contents, 'press_key', { key: 'Enter', modifiers: 'shift,control' })
    expect(sendInputEvent).toHaveBeenCalledTimes(2)
    expect(sendInputEvent.mock.calls[0]![0]).toMatchObject({ type: 'keyDown', keyCode: 'Enter', modifiers: ['shift', 'control'] })
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

describe('dialog watch', () => {
  function guest(attachThrows = false) {
    const listeners: ((...args: unknown[]) => void)[] = []
    const sendCommand = vi.fn(async () => {})
    const debuggerApi = {
      attach: vi.fn(() => { if (attachThrows) throw new Error('busy') }),
      detach: vi.fn(),
      on: vi.fn((_event: string, listener: (...args: unknown[]) => void) => { listeners.push(listener) }),
      removeListener: vi.fn(),
      sendCommand,
    }
    const contents = { isDestroyed: () => false, debugger: debuggerApi } as never
    return { contents, listeners, sendCommand, debuggerApi }
  }

  it('observes, answers, and clears a pending dialog', async () => {
    const { contents, listeners, sendCommand } = guest()
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
    const { contents } = guest(true)
    const watch = watchDialogs(contents)
    await expect(watch.answer('accept')).rejects.toMatchObject({ code: 'BROWSER_DIALOG_UNAVAILABLE' })
    watch.dispose()
  })
})

describe('browser upload', () => {
  function chooserGuest(chooserOpens = true) {
    const sendCommand = vi.fn(async (method: string) => {
      if (method === 'Page.setInterceptFileChooserDialog' && chooserOpens) {
        setTimeout(() => { for (const l of listeners) l({}, 'Page.fileChooserOpened', { backendNodeId: 42 }) }, 10)
      }
    })
    const listeners: ((...args: unknown[]) => void)[] = []
    const contents = {
      isDestroyed: () => false, getTitle: () => 'T', getURL: () => 'https://example.test/', isLoading: () => false,
      executeJavaScript: vi.fn(async (): Promise<unknown> => ({ ok: true, x: 5, y: 5 })),
      sendInputEvent: vi.fn(),
      insertText: vi.fn(async () => {}), loadURL: vi.fn(async () => {}), reload: vi.fn(),
      on: vi.fn(), removeListener: vi.fn(), once: vi.fn(),
      navigationHistory: { canGoBack: () => false, canGoForward: () => false, goBack: vi.fn(), goForward: vi.fn() },
      debugger: { attach: vi.fn(), isAttached: () => true, on: vi.fn((_e: string, l: (...a: unknown[]) => void) => { listeners.push(l) }),
        removeListener: vi.fn(), sendCommand },
    } as never
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
    const stuck = chooserGuest(false)
    const real = join(tmpdir(), `ocean-upload-stuck-${String(Date.now())}.pdf`)
    await writeFile(real, 'pdf')
    await expect(executeBrowserAgent(stuck.contents, 'upload', { ref: 'e1', path: real }))
      .rejects.toMatchObject({ code: 'BROWSER_UPLOAD_NO_CHOOSER' })
    await rm(real, { force: true })
  }, 10_000)
})
