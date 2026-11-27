import type { FileSaveResult } from '@ocean/ocean-client-ui-file-actions/types'
/** Origin-scoped boot, native directory selection, host paths of picked files, and update presentation with native confirmation actions. */

import type { DesktopChannelState, DesktopChannelChangeResult } from '@ocean/ocean-client-ui-settings-general/types'
import type { DesktopShortcutInput, ShortcutConfigSnapshot, ShortcutSaveResult } from '@ocean/ocean-client-shortcuts/protocol'
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { DESKTOP_IPC, SCHEME, type OceanDesktopProductApi, type DesktopUpdatePresentation } from './ipc.ts'
import { PLATFORM_IPC } from './platform-ipc.ts'
import { markDocumentPlatform, syncWindowFullscreen } from './preload-platform.ts'
import { syncNativeTheme } from './preload-theme.ts'
import { syncWindowsAppearance } from './preload-windows.ts'
import { installMandatoryUpdateOverlay } from './preload-mandatory-overlay.ts'
import { createDesktopBrowserBridge } from './preload-browser.ts'
import type { FileDragHandle } from '@ocean/ocean-util-file-drag'

function createProductApi(): OceanDesktopProductApi {
  return {
    protocolVersion: 1,
    fileActions: {
      save: request => ipcRenderer.invoke(DESKTOP_IPC.fileSave, request) as Promise<FileSaveResult>,
      readClipboardImage: url => ipcRenderer.invoke(DESKTOP_IPC.clipboardImageRead, url) as
        Promise<{ bytes: Uint8Array; mediaType: string }>,
    },
    browser: createDesktopBrowserBridge(),
    fileDrag: {
      prepare: (source, requestId) => ipcRenderer.invoke(DESKTOP_IPC.fileDragPrepare, source, requestId) as
        Promise<FileDragHandle | undefined>,
      cancel: (requestId) => { void ipcRenderer.invoke(DESKTOP_IPC.fileDragCancel, requestId).catch((_error: unknown) => {
        // Main-process shutdown cancels any remaining preparations.
      }) },
      start: handle => ipcRenderer.invoke(DESKTOP_IPC.fileDragStart, handle) as Promise<boolean>,
      release: (handle) => { void ipcRenderer.invoke(DESKTOP_IPC.fileDragRelease, handle).catch((_error: unknown) => {
        // Main-process shutdown also releases every prepared file.
      }) },
    },
    deviceInfo: () => ipcRenderer.invoke(DESKTOP_IPC.deviceInfo) as Promise<string>,
    keyboard: {
      closeWindow: revision => ipcRenderer.invoke(DESKTOP_IPC.shortcutsCloseWindow, revision) as Promise<void>,
      subscribe: (listener) => {
        const handle = (_event: Electron.IpcRendererEvent, input: DesktopShortcutInput): void => {
          if (input.kind === 'iframe') {
            const element = document.activeElement
            if (!(element instanceof HTMLIFrameElement) || !element.isConnected
              || !element.matches('iframe[data-sidebar-browser-frame], iframe[data-html-preview]')) return
            if (input.frameName === '' || element.name !== input.frameName) return
          }
          if (input.kind === 'webview') {
            const element = document.activeElement
            if (element?.matches('webview[data-sidebar-browser-frame]') !== true || !element.isConnected
              || input.frameName === '' || element.getAttribute('name') !== input.frameName) return
          }
          listener(input)
        }
        ipcRenderer.on(DESKTOP_IPC.shortcutsInput, handle)
        return () => { ipcRenderer.off(DESKTOP_IPC.shortcutsInput, handle) }
      },
    },
    shortcuts: {
      get: definitions => ipcRenderer.invoke(DESKTOP_IPC.shortcutsGet, definitions) as Promise<ShortcutConfigSnapshot>,
      edit: (edit, revision) => ipcRenderer.invoke(DESKTOP_IPC.shortcutsEdit, edit, revision) as Promise<ShortcutSaveResult>,
      recording: active => ipcRenderer.invoke(DESKTOP_IPC.shortcutsRecording, active) as Promise<void>,
      subscribe(listener) {
        const handle = (_event: Electron.IpcRendererEvent, snapshot: ShortcutConfigSnapshot): void => { listener(snapshot) }
        ipcRenderer.on(DESKTOP_IPC.shortcutsChanged, handle)
        return () => { ipcRenderer.off(DESKTOP_IPC.shortcutsChanged, handle) }
      },
    },
    updates: {
      channels: {
        get: () => ipcRenderer.invoke(DESKTOP_IPC.updatesChannelGet) as Promise<DesktopChannelState>,
        set: channel => ipcRenderer.invoke(DESKTOP_IPC.updatesChannelSet, channel) as Promise<DesktopChannelChangeResult>,
        subscribe(listener) {
          const handle = (_event: Electron.IpcRendererEvent, state: DesktopChannelState): void => { listener(state) }
          ipcRenderer.on(DESKTOP_IPC.updatesChannelChanged, handle)
          return () => { ipcRenderer.off(DESKTOP_IPC.updatesChannelChanged, handle) }
        },
      },
      status: () => ipcRenderer.invoke(DESKTOP_IPC.updatesStatus) as Promise<DesktopUpdatePresentation>,
      open: () => ipcRenderer.invoke(DESKTOP_IPC.updatesOpen) as Promise<void>,
      subscribe(listener) {
        const handle = (_event: Electron.IpcRendererEvent, state: DesktopUpdatePresentation): void => { listener(state) }
        ipcRenderer.on(DESKTOP_IPC.updatesPresentation, handle)
        return () => { ipcRenderer.off(DESKTOP_IPC.updatesPresentation, handle) }
      },
    },
  }
}

const remoteHost = process.argv.includes('--ocean-remote-host')
if (process.isMainFrame && location.href === `${SCHEME}://shell/remote-connection.html`) {
  contextBridge.exposeInMainWorld('oceanRemoteForm', {
    load: () => ipcRenderer.invoke(DESKTOP_IPC.remoteForm),
    connect: (address: string, token: string, remember: boolean) =>
      ipcRenderer.invoke(DESKTOP_IPC.remoteConnect, address, token, remember),
    forget: (address?: string) => ipcRenderer.invoke(DESKTOP_IPC.remoteForget, address),
    probe: (address: string) => ipcRenderer.invoke(DESKTOP_IPC.remoteProbe, address),
    startSsh: (host: string) => ipcRenderer.invoke(DESKTOP_IPC.remoteSshStart, host),
    pairLink: (link: string) => ipcRenderer.invoke(DESKTOP_IPC.remotePairLink, link),
    pair: () => ipcRenderer.invoke(DESKTOP_IPC.remotePair),
    discover: () => ipcRenderer.invoke(DESKTOP_IPC.remoteDiscover),
    pairPassword: (address: string, password: string) => ipcRenderer.invoke(DESKTOP_IPC.remotePairPassword, address, password),
    close: () => ipcRenderer.invoke(DESKTOP_IPC.remoteClose),
  })
}

if (location.protocol === `${SCHEME}:` && location.hostname === 'app') {
  contextBridge.exposeInMainWorld('oceanOnboarding', {
    hasApiKey: () => ipcRenderer.invoke(DESKTOP_IPC.onboardingApiKey) as Promise<boolean>,
    setActive: (active: boolean) => { ipcRenderer.send(DESKTOP_IPC.onboardingActive, active) },
  })
  ipcRenderer.on(DESKTOP_IPC.enterWorkspace, () => {
    const body = document.body
    const previous = body.getAttribute('tabindex')
    body.tabIndex = -1
    body.focus({ preventScroll: true })
    if (previous === null) body.removeAttribute('tabindex')
    else body.setAttribute('tabindex', previous)
  })
  syncWindowsAppearance()
  if (process.platform === 'win32') installMandatoryUpdateOverlay()
  if (!remoteHost) contextBridge.exposeInMainWorld('__OCEAN_DIRECTORY_PICKER__', {
    pick: () => ipcRenderer.invoke(DESKTOP_IPC.directoryPick) as Promise<string | null>,
  })
  // The composer cites dropped, picked, and pasted files and folders that
  // have a real path as `@path` references instead of uploading them; a
  // File without one (pasted bytes) answers '' and uploads as before.
  if (!remoteHost) contextBridge.exposeInMainWorld('__OCEAN_HOST_PATHS__', {
    pathFor: (file: File) => webUtils.getPathForFile(file),
  })
  if (process.isMainFrame) contextBridge.exposeInMainWorld('oceanDesktopHosts', {
    read: () => ipcRenderer.invoke(DESKTOP_IPC.hostSelection),
    select: (id: string) => ipcRenderer.invoke(DESKTOP_IPC.selectHost, id),
    publishSessions: (publication: import('./remote-publication.ts').DesktopHostPublication) =>
      ipcRenderer.invoke(DESKTOP_IPC.publishHostSessions, publication),
    openSession: (hostId: string, sessionId: string) => ipcRenderer.invoke(DESKTOP_IPC.openHostSession, hostId, sessionId),
    onOpenOwnedSession: (listener: (id: string) => void) => {
      const notify = (_event: Electron.IpcRendererEvent, id: string): void => { listener(id) }
      ipcRenderer.on(DESKTOP_IPC.openOwnedSession, notify)
      return () => ipcRenderer.off(DESKTOP_IPC.openOwnedSession, notify)
    },
    subscribe: (listener: () => void) => {
      const notify = (): void => { listener() }
      ipcRenderer.on(DESKTOP_IPC.hostSelectionChanged, notify)
      return () => ipcRenderer.off(DESKTOP_IPC.hostSelectionChanged, notify)
    },
  })
  contextBridge.exposeInMainWorld('oceanDesktopBoot', {
    ready: () => ipcRenderer.invoke(DESKTOP_IPC.boot) as Promise<unknown>,
    failed: (message: string) => ipcRenderer.invoke(DESKTOP_IPC.bootFailed, message) as Promise<void>,
    connectionLost: (): void => { ipcRenderer.send(DESKTOP_IPC.connectionLost) },
    onRouteChanged: (listener: (route: { streamBaseUrl: string }) => void): (() => void) => {
      const notify = (_event: unknown, route: { streamBaseUrl: string }): void => { listener(route) }
      ipcRenderer.on(DESKTOP_IPC.routeChanged, notify)
      return () => { ipcRenderer.off(DESKTOP_IPC.routeChanged, notify) }
    },
    onForwardedPorts: (listener: (ports: number[]) => void): (() => void) => {
      const notify = (_event: unknown, ports: number[]): void => { listener(ports) }
      ipcRenderer.on(DESKTOP_IPC.forwardedPorts, notify)
      return () => { ipcRenderer.off(DESKTOP_IPC.forwardedPorts, notify) }
    },
  })
  contextBridge.exposeInMainWorld('oceanPlatform', {
    open: (page: 'usage' | 'top-up', bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke(PLATFORM_IPC.open, page, bounds),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke(PLATFORM_IPC.bounds, bounds),
    close: () => ipcRenderer.invoke(PLATFORM_IPC.close),
  })
}

markDocumentPlatform()
syncWindowFullscreen()
syncNativeTheme()
// Main-process IPC also verifies the owning window and top frame.
contextBridge.exposeInMainWorld('oceanDesktop', location.protocol === `${SCHEME}:` && location.hostname === 'app' && process.isMainFrame ? createProductApi() : { protocolVersion: 1 })

if (location.protocol === `${SCHEME}:` && location.hostname === 'app') {
  contextBridge.exposeInMainWorld('__OCEAN_LOCALE__', {
    read: () => ipcRenderer.invoke(DESKTOP_IPC.localeBootstrap),
    onChange: (locale: string) => { ipcRenderer.send(DESKTOP_IPC.localeChanged, locale) },
  })
}
