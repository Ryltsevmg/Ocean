import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import {
  assertAgentRef,
  assertAgentUrl,
  BrowserAgentError,
  captureBrowserScreenshot,
  executeBrowserAgent,
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
    await expect(captureBrowserScreenshot(guestWith(raster(100, 64)), { maxBytes: 1024 }))
      .rejects.toMatchObject({ code: 'BROWSER_SCREENSHOT_TOO_LARGE' })
    await expect(captureBrowserScreenshot(guestWith(raster(100, 8), true), {}))
      .rejects.toMatchObject({ code: 'BROWSER_GUEST_CLOSED' })
  })
})
