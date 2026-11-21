import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import {
  assertAgentRef,
  assertAgentUrl,
  BrowserAgentError,
  executeBrowserAgent,
  isBrowserAgentCommand,
} from '../src/browser-agent.ts'

interface GuestState {
  readonly title?: string
  readonly url?: string
  readonly loading?: boolean
}

function guest(state: GuestState = {}): WebContents {
  return {
    isDestroyed: () => false,
    getTitle: () => state.title ?? 'Example',
    getURL: () => state.url ?? 'https://example.test/',
    isLoading: () => state.loading ?? false,
    executeJavaScript: vi.fn(async () => ({ title: 'Example', url: 'https://example.test/', text: 'button "Save"', truncated: false })),
    sendInputEvent: vi.fn(),
    insertText: vi.fn(async () => {}),
    loadURL: vi.fn(async () => {}),
    reload: vi.fn(),
    on: vi.fn(), removeListener: vi.fn(), once: vi.fn(),
    navigationHistory: { canGoBack: () => true, canGoForward: () => false, goBack: vi.fn(), goForward: vi.fn() },
  } as unknown as WebContents
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
    const contents = guest({ title: 'Title', url: 'https://example.test/next', loading: true })
    await expect(executeBrowserAgent(contents, 'info', {})).resolves.toBe(
      'title: Title\nurl: https://example.test/next\nloading: true')
    expect(contents.executeJavaScript).not.toHaveBeenCalled()
  })

  it('returns the bounded semantic snapshot', async () => {
    const contents = guest()
    await expect(executeBrowserAgent(contents, 'snapshot', {})).resolves.toContain('button "Save"')
    expect(contents.executeJavaScript).toHaveBeenCalledOnce()
  })

  it('clicks a snapshot ref with native input and reads the result', async () => {
    vi.useFakeTimers()
    const contents = guest()
    const execute = vi.mocked(contents.executeJavaScript)
    execute.mockResolvedValueOnce({ ok: true, x: 10, y: 20 }).mockResolvedValueOnce(
      { title: 'Example', url: 'https://example.test/', text: 'link "Next"', truncated: false })
    const pending = executeBrowserAgent(contents, 'click', { ref: 'e4' })
    await vi.advanceTimersByTimeAsync(600)
    await expect(pending).resolves.toContain('link "Next"')
    expect(contents.sendInputEvent).toHaveBeenCalledTimes(3)
    expect(contents.sendInputEvent).toHaveBeenNthCalledWith(1, { type: 'mouseMove', x: 10, y: 20 })
  })

  it('refuses a sensitive field and reports a stale ref', async () => {
    const sensitive = guest()
    vi.mocked(sensitive.executeJavaScript).mockResolvedValueOnce({ ok: false, reason: 'sensitive' })
    await expect(executeBrowserAgent(sensitive, 'fill', { ref: 'e1', text: 'secret' }))
      .rejects.toMatchObject({ code: 'BROWSER_SECRET_FIELD' })

    const missing = guest()
    vi.mocked(missing.executeJavaScript).mockResolvedValueOnce({ ok: false, reason: 'missing' })
    await expect(executeBrowserAgent(missing, 'click', { ref: 'e9' }))
      .rejects.toMatchObject({ code: 'BROWSER_REF_STALE' })
  })
})
