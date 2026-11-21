import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

const sessions = new Map<string, unknown>()
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp/ocean-test-userdata' },
  session: { fromPartition: (partition: string) => {
    const value = {
      setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(),
      setDevicePermissionHandler: vi.fn(), setDisplayMediaRequestHandler: vi.fn(),
      on: vi.fn(), webRequest: { onBeforeRequest: vi.fn() },
    }
    sessions.set(partition, value)
    return value
  } },
}))

import { DesktopBrowserGuests } from '../src/browser-guests.ts'

const handoffs: { lease: string; message: string }[] = []
function owner(): EventEmitter & { isDestroyed: () => boolean } {
  return Object.assign(new EventEmitter(), { isDestroyed: () => false })
}

let lastGuest: EventEmitter & { session: EventEmitter }
function attach(guests: DesktopBrowserGuests, ownerWebContents: ReturnType<typeof owner>, index: number): string {
  const { lease, partition } = guests.acquire(ownerWebContents as never, 'workspace')
  const guest = Object.assign(new EventEmitter(), {
    getTitle: () => `Page ${String(index)}`, getURL: () => `about:blank#${lease}`,
    isDestroyed: () => false, close: vi.fn(),
    executeJavaScript: vi.fn(async (): Promise<unknown> => ({ title: 'T', url: 'https://example.test/1', text: 'snapshot', truncated: false })),
    debugger: { attach: vi.fn(), on: vi.fn(), removeListener: vi.fn(), sendCommand: vi.fn(async () => {}) },
    setWindowOpenHandler: vi.fn(),
    session: new EventEmitter(),
  })
  lastGuest = guest
  ownerWebContents.emit('will-attach-webview', { preventDefault: vi.fn() }, {}, { src: `about:blank#${lease}`, partition })
  ownerWebContents.emit('did-attach-webview', {}, guest)
  guest.emit('dom-ready')
  return lease
}

describe('DesktopBrowserGuests multi-tab sharing', () => {
  let guests: DesktopBrowserGuests
  let ownerWebContents: ReturnType<typeof owner>
  beforeEach(() => {
    handoffs.length = 0
    guests = new DesktopBrowserGuests(() => 'http://127.0.0.1:4000/', (request) => { handoffs.push(request) })
    ownerWebContents = owner()
    guests.bind({ webContents: ownerWebContents } as never, () => () => {})
  })

  it('binds several tabs, keeps the newest active, and rotates on tab_select', async () => {
    const first = attach(guests, ownerWebContents, 1)
    const second = attach(guests, ownerWebContents, 2)
    guests.bindAgent(ownerWebContents as never, first, 'session-1')
    guests.bindAgent(ownerWebContents as never, second, 'session-1')
    guests.bindAgent(ownerWebContents as never, second, 'session-1')
    const listed = await guests.executeAgent('session-1', 'tabs', {})
    if (!listed.ok) throw new Error('tabs listing failed')
    expect(listed.text).toContain('* 0 Page 2')
    const selected = await guests.executeAgent('session-1', 'tab_select', { index: 1 })
    expect(selected.ok).toBe(true)
    const again = await guests.executeAgent('session-1', 'tabs', {})
    if (!again.ok) throw new Error('tabs listing failed')
    expect(again.text).toContain('* 0 Page 1')
    const invalid = await guests.executeAgent('session-1', 'tab_select', { index: 7 })
    if (invalid.ok) throw new Error('invalid index accepted')
    expect(invalid.error.code).toBe('BROWSER_TAB_INVALID')
  })

  it('refuses a ninth shared tab and clears bindings on unbind', async () => {
    const keys: string[] = []
    for (let index = 0; index < 9; index++) keys.push(attach(guests, ownerWebContents, index))
    for (const key of keys.slice(0, 8)) guests.bindAgent(ownerWebContents as never, key, 'session-2')
    expect(() => { guests.bindAgent(ownerWebContents as never, keys[8]!, 'session-2') }).toThrow('maximum number of tabs')
    guests.unbindAgent(ownerWebContents as never, keys[7])
    const result = await guests.executeAgent('session-2', 'tabs', {})
    if (!result.ok) throw new Error('tabs listing failed')
    expect(result.text).toContain('* 0 Page 6')
  })

  it('lists downloads captured while the tab is shared', async () => {
    const key = attach(guests, ownerWebContents, 1)
    guests.bindAgent(ownerWebContents as never, key, 'session-3')
    const empty = await guests.executeAgent('session-3', 'downloads', {})
    if (!empty.ok) throw new Error('downloads failed')
    expect(empty.text).toBe('no downloads')
    const item = Object.assign(new EventEmitter(), {
      getFilename: () => 'report.pdf', setSavePath: vi.fn(), isDestroyed: () => false,
    })
    lastGuest.session.emit('will-download', { preventDefault: vi.fn() }, item, lastGuest)
    const listed = await guests.executeAgent('session-3', 'downloads', {})
    if (!listed.ok) throw new Error('downloads failed')
    expect(listed.text).toContain('0 saving report.pdf')
    item.emit('done', {}, 'completed')
    const done = await guests.executeAgent('session-3', 'downloads', {})
    if (!done.ok) throw new Error('downloads failed')
    expect(done.text).toContain('0 done report.pdf')
  })

  it('holds the tab during a handoff until the person resumes', async () => {
    const key = attach(guests, ownerWebContents, 1)
    guests.bindAgent(ownerWebContents as never, key, 'session-4')
    let handoffMessage: string | undefined
    const pending = guests.executeAgent('session-4', 'handoff', { message: 'log in' }).then((result) => {
      handoffMessage = result.ok ? result.text : result.error.code
      return handoffMessage
    })
    await vi.waitFor(() => { expect(handoffs).toHaveLength(1) })
    expect(handoffs[0]).toMatchObject({ lease: key, message: 'log in' })
    const blocked = await guests.executeAgent('session-4', 'snapshot', {})
    if (blocked.ok) throw new Error('snapshot accepted during handoff')
    expect(blocked.error.code).toBe('BROWSER_HANDOFF_ACTIVE')
    guests.resumeAgent(key)
    await expect(pending).resolves.toContain('snapshot')
  })

  it('reports not-shared for an unknown Session', async () => {
    const result = await guests.executeAgent('session-9', 'snapshot', {})
    if (result.ok) throw new Error('unknown session accepted')
    expect(result.error.code).toBe('BROWSER_NOT_SHARED')
  })
})
