// @vitest-environment jsdom
import type { DesktopFileDrag, FileDragHandle, FileDragRequestId } from '@ocean/ocean-util-file-drag'
import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installMandatoryUpdateOverlay } from '../src/preload-mandatory-overlay.ts'
import { syncWindowsAppearance } from '../src/preload-windows.ts'
import { DESKTOP_IPC, type OceanDesktopProductApi } from '../src/ipc.ts'

const electron = vi.hoisted(() => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), off: vi.fn(), send: vi.fn() },
  webUtils: { getPathForFile: vi.fn() },
}))
vi.mock('electron', () => electron)
vi.mock('../src/preload-platform.ts', () => ({ markDocumentPlatform: vi.fn(), syncWindowFullscreen: vi.fn() }))
vi.mock('../src/preload-theme.ts', () => ({ syncNativeTheme: vi.fn() }))
vi.mock('../src/preload-windows.ts', () => ({ syncWindowsAppearance: vi.fn() }))
vi.mock('../src/preload-mandatory-overlay.ts', () => ({ installMandatoryUpdateOverlay: vi.fn() }))

beforeEach(() => { vi.stubGlobal('process', { ...process, isMainFrame: true }) })
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.resetModules() })

it('reads only native login API-key presence through the onboarding bridge', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  electron.ipcRenderer.invoke.mockResolvedValueOnce(true)
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanOnboarding')?.[1] as { hasApiKey(): Promise<boolean> }
  expect(await api.hasApiKey()).toBe(true)
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_IPC.onboardingApiKey)
})

it('exposes onboarding size activation to the application document', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanOnboarding')?.[1] as { setActive(active: boolean): void }
  api.setActive(true)
  api.setActive(false)
  expect(electron.ipcRenderer.send.mock.calls).toEqual([[DESKTOP_IPC.onboardingActive, true], [DESKTOP_IPC.onboardingActive, false]])
})

it('routes original-file requests through the trusted application bridge', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  const request = { url: 'https://images.example/original.gif', name: 'image.gif', mode: 'download' as const }
  await api.fileActions.save(request)
  await api.fileActions.readClipboardImage('https://images.example/original.gif')
  expect(electron.ipcRenderer.invoke.mock.calls).toEqual([
    [DESKTOP_IPC.fileSave, request],
    [DESKTOP_IPC.clipboardImageRead, 'https://images.example/original.gif'],
  ])
})

it('limits product documents to update status and a native confirmation action', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/index.html'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  await api.updates.status()
  await api.updates.open()
  expect(electron.ipcRenderer.invoke.mock.calls).toEqual([[DESKTOP_IPC.updatesStatus], [DESKTOP_IPC.updatesOpen]])
  expect(api).not.toHaveProperty('plugins')
  expect(api).not.toHaveProperty('backend')
  expect(api.updates).not.toHaveProperty('install')
  const listener = vi.fn()
  const dispose = api.updates.subscribe(listener)
  const handler = electron.ipcRenderer.on.mock.calls.find(([channel]) => channel === DESKTOP_IPC.updatesPresentation)?.[1] as
    (event: unknown, state: unknown) => void
  handler({}, { visible: false })
  expect(listener).toHaveBeenCalledWith({ visible: false })
  dispose()
  expect(electron.ipcRenderer.off).toHaveBeenCalledWith(DESKTOP_IPC.updatesPresentation, handler)
})

it.each(['dsh-app://shell/plugin-manager.html', 'dsh-app://other/index.html', 'https://shell/startup.html', 'http://example.com/'])('exposes only the carrier marker to %s', async (url) => {
  vi.stubGlobal('location', new URL(url))
  await import('../src/preload-app.ts')
  expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith('oceanDesktop', { protocolVersion: 1 })
  expect(electron.ipcRenderer.on.mock.calls.some(([channel]) => channel === DESKTOP_IPC.browserOpenRequested)).toBe(false)
})

it('reads the local machine description only from the application main frame', async () => {
  const description = 'platform=darwin; os=15.6; app_arch=arm64; cpu=Apple M4; memory_gib=32.0'
  vi.stubGlobal('location', new URL('dsh-app://app/index.html'))
  electron.ipcRenderer.invoke.mockResolvedValue(description)
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  await expect(api.deviceInfo()).resolves.toBe(description)
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.deviceInfo)
  vi.resetModules()
  electron.contextBridge.exposeInMainWorld.mockClear()
  vi.stubGlobal('process', { ...process, isMainFrame: false })
  await import('../src/preload-app.ts')
  expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith('oceanDesktop', { protocolVersion: 1 })
})

it('exposes asynchronous boot only to the local application document', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktopBoot')?.[1] as { ready(): Promise<unknown>; failed(message: string): Promise<void> }
  await api.ready()
  await api.failed('client mount failed')
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_IPC.bootFailed, 'client mount failed')
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_IPC.boot)
  vi.resetModules()
  electron.contextBridge.exposeInMainWorld.mockClear()
  vi.stubGlobal('location', new URL('https://other.example/'))
  await import('../src/preload-app.ts')
  expect(electron.contextBridge.exposeInMainWorld.mock.calls.some(([name]) => name === 'oceanDesktopBoot')).toBe(false)
})

it('reports a lost Host and follows route changes through the boot bridge', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktopBoot')?.[1] as {
    connectionLost(): void
    onRouteChanged(listener: (route: { streamBaseUrl: string }) => void): () => void
  }
  api.connectionLost()
  expect(electron.ipcRenderer.send.mock.calls).toEqual([[DESKTOP_IPC.connectionLost]])
  const listener = vi.fn()
  const off = api.onRouteChanged(listener)
  const handler = electron.ipcRenderer.on.mock.calls.find(([channel]) => channel === DESKTOP_IPC.routeChanged)![1] as
    (event: unknown, route: unknown) => void
  handler({}, { streamBaseUrl: 'https://ocean.example/mount/' })
  expect(listener).toHaveBeenCalledExactlyOnceWith({ streamBaseUrl: 'https://ocean.example/mount/' })
  off()
  expect(electron.ipcRenderer.off).toHaveBeenCalledWith(DESKTOP_IPC.routeChanged, handler)
})

it('exposes a directory picker only to the local application document', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === '__OCEAN_DIRECTORY_PICKER__')?.[1] as { pick(): Promise<string | null> }
  electron.ipcRenderer.invoke.mockResolvedValue('/workspace')
  await expect(api.pick()).resolves.toBe('/workspace')
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith(DESKTOP_IPC.directoryPick)
  for (const url of ['dsh-app://shell/startup.html', 'https://example.com/']) {
    vi.resetModules()
    electron.contextBridge.exposeInMainWorld.mockClear()
    vi.stubGlobal('location', new URL(url))
    await import('../src/preload-app.ts')
    expect(electron.contextBridge.exposeInMainWorld.mock.calls.some(([name]) => name === '__OCEAN_DIRECTORY_PICKER__')).toBe(false)
  }
})

it('reports host paths of picked files only to the local application document', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === '__OCEAN_HOST_PATHS__')?.[1] as { pathFor(file: File): string }
  const picked = new File(['x'], 'notes.md')
  electron.webUtils.getPathForFile.mockReturnValue('/Users/me/notes.md')
  expect(api.pathFor(picked)).toBe('/Users/me/notes.md')
  expect(electron.webUtils.getPathForFile).toHaveBeenCalledExactlyOnceWith(picked)
  for (const url of ['dsh-app://shell/startup.html', 'https://example.com/']) {
    vi.resetModules()
    electron.contextBridge.exposeInMainWorld.mockClear()
    vi.stubGlobal('location', new URL(url))
    await import('../src/preload-app.ts')
    expect(electron.contextBridge.exposeInMainWorld.mock.calls.some(([name]) => name === '__OCEAN_HOST_PATHS__')).toBe(false)
  }
})

it.each(['dsh-app://app/', 'dsh-app://shell/plugin-manager.html', 'https://example.com/'])(
  'installs Windows appearance only for the application document (%s)', async (url) => {
    vi.stubGlobal('location', new URL(url))
    await import('../src/preload-app.ts')
    expect(syncWindowsAppearance).toHaveBeenCalledTimes(url === 'dsh-app://app/' ? 1 : 0)
  },
)

it('moves welcome-entry focus to the document without changing keyboard tab order', async () => {
  const dom = new JSDOM('<body><button>Sidebar</button><input></body>')
  try {
    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('location', new URL('dsh-app://app/'))
    await import('../src/preload-app.ts')
    const enter = electron.ipcRenderer.on.mock.calls.find(([channel]) => channel === DESKTOP_IPC.enterWorkspace)![1] as () => void
    const button = dom.window.document.querySelector('button')!
    button.focus()
    enter()
    expect(dom.window.document.activeElement).toBe(dom.window.document.body)
    expect(dom.window.document.body.hasAttribute('tabindex')).toBe(false)
    expect(button.tabIndex).toBe(0)
    dom.window.document.body.setAttribute('tabindex', '-1')
    button.focus()
    enter()
    expect(dom.window.document.body.getAttribute('tabindex')).toBe('-1')
  } finally { dom.window.close() }
})

it.each(['win32', 'darwin'] as const)('installs the embedded mandatory UI only in the Windows app document (%s)', async (platform) => {
  vi.stubGlobal('process', { ...process, platform })
  for (const url of ['dsh-app://app/', 'dsh-app://shell/mandatory-update.html', 'https://example.com/']) {
    vi.resetModules()
    vi.mocked(installMandatoryUpdateOverlay).mockClear()
    vi.stubGlobal('location', new URL(url))
    await import('../src/preload-app.ts')
    expect(installMandatoryUpdateOverlay).toHaveBeenCalledTimes(platform === 'win32' && url === 'dsh-app://app/' ? 1 : 0)
  }
})

it('exposes constrained shortcut operations and releases configuration subscriptions', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  await api.shortcuts.get([])
  expect(api.shortcuts).not.toHaveProperty('reload')
  await api.shortcuts.recording(true)
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_IPC.shortcutsGet, [])
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_IPC.shortcutsRecording, true)
  const listener = vi.fn()
  const off = api.shortcuts.subscribe(listener)
  const handler = electron.ipcRenderer.on.mock.calls.find(([name]) => name === DESKTOP_IPC.shortcutsChanged)![1] as
    (event: unknown, state: unknown) => void
  handler({}, { status: 'ready' })
  expect(listener).toHaveBeenCalledWith({ status: 'ready' })
  off(); expect(electron.ipcRenderer.off).toHaveBeenCalledWith(DESKTOP_IPC.shortcutsChanged, handler)
})

it('withholds the product API from same-origin child frames', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  vi.stubGlobal('process', { ...process, isMainFrame: false })
  await import('../src/preload-app.ts')
  expect(electron.contextBridge.exposeInMainWorld).toHaveBeenCalledWith('oceanDesktop', { protocolVersion: 1 })
})

it.each([
  ['dsh-app://shell/remote-connection.html', true, true],
  ['dsh-app://shell/remote-connection.html', false, false],
  ['dsh-app://shell/remote-connection.html?other', true, false],
  ['dsh-app://app/remote-connection.html', true, false],
  ['https://shell/remote-connection.html', true, false],
] as const)('scopes remote credentials to the exact form main frame (%s, %s)', async (url, mainFrame, exposed) => {
  vi.stubGlobal('location', new URL(url))
  vi.stubGlobal('process', { ...process, isMainFrame: mainFrame })
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanRemoteForm')?.[1] as
    {
      load(): Promise<unknown>
      connect(address: string, token: string, remember: boolean): Promise<unknown>
      forget(address: string): Promise<unknown>
      close(): Promise<unknown>
    } | undefined
  expect(api !== undefined).toBe(exposed)
  if (api === undefined) return
  await api.load()
  await api.connect('https://host.example/', 'fixture-token', false)
  await api.forget('https://host.example/')
  await api.close()
  expect(electron.ipcRenderer.invoke.mock.calls).toEqual([
    [DESKTOP_IPC.remoteForm], [DESKTOP_IPC.remoteConnect, 'https://host.example/', 'fixture-token', false],
    [DESKTOP_IPC.remoteForget, 'https://host.example/'], [DESKTOP_IPC.remoteClose],
  ])
})

it('publishes only through the application main frame and releases Host subscriptions', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  vi.stubGlobal('process', { ...process, isMainFrame: true, argv: [...process.argv, '--ocean-remote-host'] })
  await import('../src/preload-app.ts')
  const names = electron.contextBridge.exposeInMainWorld.mock.calls.map(([name]) => name as string)
  expect(names).not.toContain('oceanRemoteForm')
  expect(names).not.toContain('__OCEAN_HOST_PATHS__')
  expect(names).not.toContain('__OCEAN_DIRECTORY_PICKER__')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktopHosts')![1] as {
    publishSessions(publication: object): Promise<unknown>
    subscribe(listener: () => void): () => void
    onOpenOwnedSession(listener: (id: string) => void): () => void
  }
  const publication = { revision: 1, sessions: [], pendingApprovals: 2, pendingQuestions: 3 }
  await api.publishSessions(publication)
  expect(electron.ipcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_IPC.publishHostSessions, publication)
  const listener = vi.fn()
  const off = api.subscribe(listener)
  const openOff = api.onOpenOwnedSession(listener)
  off(); openOff()
  for (const channel of [DESKTOP_IPC.hostSelectionChanged, DESKTOP_IPC.openOwnedSession]) {
    const callback = electron.ipcRenderer.on.mock.calls.find(([name]) => name === channel)![1] as (...args: unknown[]) => void
    expect(electron.ipcRenderer.off).toHaveBeenCalledWith(channel, callback)
  }
  vi.resetModules()
  electron.contextBridge.exposeInMainWorld.mockClear()
  vi.stubGlobal('process', { ...process, isMainFrame: false })
  await import('../src/preload-app.ts')
  expect(electron.contextBridge.exposeInMainWorld.mock.calls.some(([name]) => name === 'oceanDesktopHosts')).toBe(false)
})

it('forwards only the focused product iframe and releases native input subscriptions', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  const listener = vi.fn()
  const off = api.keyboard.subscribe(listener)
  const handler = electron.ipcRenderer.on.mock.calls.find(([name]) => name === DESKTOP_IPC.shortcutsInput)![1] as
    (event: unknown, state: unknown) => void
  const input = { kind: 'iframe', frameName: 'preview', revision: 'current' }
  handler({}, input)
  const frame = document.createElement('iframe')
  document.body.append(frame)
  frame.name = 'preview'
  frame.focus()
  handler({}, input)
  expect(listener).not.toHaveBeenCalled()
  frame.setAttribute('data-html-preview', '')
  handler({}, { ...input, frameName: 'stale' })
  handler({}, { ...input, frameName: '' })
  expect(listener).not.toHaveBeenCalled()
  handler({}, input)
  expect(listener).toHaveBeenCalledExactlyOnceWith(input)
  frame.remove()
  handler({}, input)
  expect(listener).toHaveBeenCalledTimes(1)
  const menu = { kind: 'menu', commandId: 'page.close', revision: 'current' }
  handler({}, menu)
  expect(listener).toHaveBeenLastCalledWith(menu)
  off()
  expect(electron.ipcRenderer.off).toHaveBeenCalledWith(DESKTOP_IPC.shortcutsInput, handler)
})

it('forwards browser guest input only for the focused live webview lease', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  const listener = vi.fn()
  const off = api.keyboard.subscribe(listener)
  const handler = electron.ipcRenderer.on.mock.calls.find(([name]) => name === DESKTOP_IPC.shortcutsInput)![1] as
    (event: unknown, state: unknown) => void
  const input = { kind: 'webview', frameName: 'guest', revision: 'current' }
  const frame = document.createElement('webview')
  frame.tabIndex = 0
  frame.setAttribute('name', 'guest')
  document.body.append(frame)
  frame.focus()
  handler({}, input)
  expect(listener).not.toHaveBeenCalled()
  frame.setAttribute('data-sidebar-browser-frame', 'webview')
  handler({}, { ...input, frameName: '' })
  handler({}, { ...input, frameName: 'old' })
  expect(listener).not.toHaveBeenCalled()
  handler({}, input)
  expect(listener).toHaveBeenCalledExactlyOnceWith(input)
  const other = document.createElement('input')
  document.body.append(other)
  other.focus()
  handler({}, input)
  frame.remove()
  handler({}, input)
  expect(listener).toHaveBeenCalledOnce()
  off()
})

it('prepares original image bytes and starts native drags without renderer filesystem paths', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  const bytes = new Uint8Array([137, 80, 78, 71])
  electron.ipcRenderer.invoke.mockResolvedValueOnce('image-handle').mockResolvedValueOnce(true).mockResolvedValueOnce(undefined)
  await expect(api.fileDrag.prepare({ kind: 'bytes', bytes, name: 'original.png', mediaType: 'image/png' }, 'request' as FileDragRequestId)).resolves.toBe('image-handle')
  await expect(api.fileDrag.start('image-handle' as FileDragHandle)).resolves.toBe(true)
  api.fileDrag.release('image-handle' as FileDragHandle)
  api.fileDrag.cancel('request' as FileDragRequestId)
  expect(electron.ipcRenderer.invoke.mock.calls).toEqual([
    [DESKTOP_IPC.fileDragPrepare, { kind: 'bytes', bytes, name: 'original.png', mediaType: 'image/png' }, 'request'],
    [DESKTOP_IPC.fileDragStart, 'image-handle'],
    [DESKTOP_IPC.fileDragRelease, 'image-handle'],
    [DESKTOP_IPC.fileDragCancel, 'request'],
  ])
})

// The Host and Client compiler faces share no runtime entry; this assignment checks their image protocol.
const imageProtocol = (value: import('../src/ipc.ts').OceanDesktopProductApi['fileDrag']): DesktopFileDrag => value
const imageProtocolBack = (value: DesktopFileDrag): import('../src/ipc.ts').OceanDesktopProductApi['fileDrag'] => value
void imageProtocol
void imageProtocolBack


it('exposes channel choices and scoped subscriptions without exposing updater objects', async () => {
  vi.stubGlobal('location', new URL('dsh-app://app/index.html'))
  await import('../src/preload-app.ts')
  const api = electron.contextBridge.exposeInMainWorld.mock.calls.find(([name]) => name === 'oceanDesktop')?.[1] as OceanDesktopProductApi
  await api.updates.channels.get()
  await api.updates.channels.set('stable')
  expect(electron.ipcRenderer.invoke.mock.calls).toEqual([[DESKTOP_IPC.updatesChannelGet], [DESKTOP_IPC.updatesChannelSet, 'stable']])
  const listener = vi.fn()
  const dispose = api.updates.channels.subscribe(listener)
  const handler = electron.ipcRenderer.on.mock.calls.find(([channel]) => channel === DESKTOP_IPC.updatesChannelChanged)?.[1] as
    (event: unknown, state: unknown) => void
  const state = { channel: 'stable', packagedChannel: 'nightly', changing: false }
  handler({}, state)
  expect(listener).toHaveBeenCalledWith(state)
  dispose()
  expect(electron.ipcRenderer.off).toHaveBeenCalledWith(DESKTOP_IPC.updatesChannelChanged, handler)
})
