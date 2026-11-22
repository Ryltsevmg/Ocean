import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const sessions = new Map<string, EventEmitter>()
// Each test gets its own userData so a leftover download cannot rename the next run's file.
const state = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => state.userData },
  session: { fromPartition: (partition: string) => {
    const value = Object.assign(new EventEmitter(), {
      setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(),
      setDevicePermissionHandler: vi.fn(), setDisplayMediaRequestHandler: vi.fn(),
      webRequest: { onBeforeRequest: vi.fn() },
    })
    if (!sessions.has(partition)) sessions.set(partition, value)
    return sessions.get(partition)
  } },
}))

import { DesktopBrowserGuests } from '../src/browser-guests.ts'

const handoffs: { lease: string; message: string }[] = []
function owner(): EventEmitter & { isDestroyed: () => boolean } {
  return Object.assign(new EventEmitter(), { isDestroyed: () => false })
}

let nextGuestId = 1
const guestObjects: EventEmitter[] = []
function attach(guests: DesktopBrowserGuests, ownerWebContents: ReturnType<typeof owner>, index: number): string {
  const { lease, partition } = guests.acquire(ownerWebContents as never, 'workspace')
  const guest = Object.assign(new EventEmitter(), {
    id: nextGuestId++,
    getTitle: () => `Page ${String(index)}`, getURL: () => `about:blank#${lease}`,
    isDestroyed: () => false, close: vi.fn(),
    executeJavaScript: vi.fn(async (): Promise<unknown> => ({ title: 'T', url: 'https://example.test/1', text: 'snapshot', truncated: false })),
    debugger: { attach: vi.fn(), on: vi.fn(), removeListener: vi.fn(), sendCommand: vi.fn(async () => {}) },
    setWindowOpenHandler: vi.fn(),
    session: new EventEmitter(),
  })
  guestObjects.push(guest)
  ownerWebContents.emit('will-attach-webview', { preventDefault: vi.fn() }, {}, { src: `about:blank#${lease}`, partition })
  ownerWebContents.emit('did-attach-webview', {}, guest)
  guest.emit('dom-ready')
  return lease
}

describe('DesktopBrowserGuests multi-tab sharing', () => {
  let guests: DesktopBrowserGuests
  let ownerWebContents: ReturnType<typeof owner>
  beforeEach(async () => {
    state.userData = await mkdtemp(join(tmpdir(), 'ocean-desktop-userdata-'))
    handoffs.length = 0
    guestObjects.length = 0
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

  it('captures downloads once per partition and attributes them by source guest', async () => {
    const first = attach(guests, ownerWebContents, 1)
    const second = attach(guests, ownerWebContents, 2)
    guests.bindAgent(ownerWebContents as never, first, 'session-3')
    guests.bindAgent(ownerWebContents as never, second, 'session-3')
    const sharedSession = [...sessions.values()].at(-1)!
    const [firstGuest] = guestObjects
    // The active tab is the newest (second); a download from the inactive shared tab belongs to it.
    const item = Object.assign(new EventEmitter(), { getFilename: () => 'report.pdf', setSavePath: vi.fn() })
    sharedSession.emit('will-download', { preventDefault: vi.fn() }, item, firstGuest)
    const activeList = await guests.executeAgent('session-3', 'downloads', {})
    if (!activeList.ok) throw new Error('downloads failed')
    expect(activeList.text).toBe('no downloads')
    // One handler must not cancel a shared download because a newer listener ran first.
    expect(item.setSavePath).toHaveBeenCalled()
    const switchedList = await guests.executeAgent('session-3', 'tab_select', { index: 1 })
    expect(switchedList.ok).toBe(true)
    const listed = await guests.executeAgent('session-3', 'downloads', {})
    if (!listed.ok) throw new Error('downloads failed')
    expect(listed.text).toContain('report.pdf')
  })

  it('cancels downloads from sources with no lease', async () => {
    attach(guests, ownerWebContents, 1)
    const sharedSession = [...sessions.values()].at(-1)!
    const blocked = { preventDefault: vi.fn() }
    sharedSession.emit('will-download', blocked, Object.assign(new EventEmitter(), { getFilename: () => 'x.bin', setSavePath: vi.fn() }), { id: 999 })
    expect(blocked.preventDefault).toHaveBeenCalled()
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

  it('neutralizes a traversal filename and keeps repeated names apart', async () => {
    const key = attach(guests, ownerWebContents, 1)
    guests.bindAgent(ownerWebContents as never, key, 'session-3')
    const sharedSession = [...sessions.values()].at(-1)!
    const source = guestObjects[0]
    const download = (name: string) => Object.assign(new EventEmitter(), {
      getFilename: () => name, setSavePath: vi.fn(),
    })
    const evil = download('../../../evil.sh')
    sharedSession.emit('will-download', { preventDefault: vi.fn() }, evil, source)
    const firstPath = evil.setSavePath.mock.calls[0]![0] as string
    expect(firstPath).not.toContain('..')
    expect(basename(firstPath)).toBe('evil.sh')
    expect(firstPath.startsWith(join(state.userData, 'sidebar-browser-downloads'))).toBe(true)
    const duplicate = download('evil.sh')
    sharedSession.emit('will-download', { preventDefault: vi.fn() }, duplicate, source)
    expect(basename(duplicate.setSavePath.mock.calls[0]![0] as string)).toBe('evil-1.sh')
    const listed = await guests.executeAgent('session-3', 'downloads', {})
    if (!listed.ok) throw new Error('downloads failed')
    expect(listed.text).toContain('evil.sh')
    expect(listed.text).toContain('evil-1.sh')
  })

  afterEach(async () => {
    await rm(state.userData, { recursive: true, force: true })
  })

  it('reports not-shared for an unknown Session', async () => {
    const result = await guests.executeAgent('session-9', 'snapshot', {})
    if (result.ok) throw new Error('unknown session accepted')
    expect(result.error.code).toBe('BROWSER_NOT_SHARED')
  })
})
