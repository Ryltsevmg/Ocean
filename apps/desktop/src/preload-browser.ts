/** Lease-scoped browser operations and one main-process event subscription per window. */
import { ipcRenderer } from 'electron'
import type { DesktopBrowserBridge, DesktopBrowserLeaseId } from '@ocean/ocean-client-ui-sidebar-browser/types'
import { DESKTOP_IPC } from './ipc.ts'

/** @returns browser operations that expose neither IPC nor Electron objects. */
export function createDesktopBrowserBridge(): DesktopBrowserBridge {
  const listeners = new Map<DesktopBrowserLeaseId, Set<(url: string) => void>>()
  ipcRenderer.on(DESKTOP_IPC.browserOpenRequested, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || !('lease' in request) || !('url' in request)
      || typeof request.lease !== 'string' || typeof request.url !== 'string') return
    const callbacks = listeners.get(request.lease as DesktopBrowserLeaseId)
    if (callbacks === undefined) return
    for (const callback of [...callbacks]) {
      try { callback(request.url) }
      catch (error) { console.error('Desktop browser link handler failed', error) }
    }
  })
  const handoffListeners = new Set<(lease: string, message: string) => void>()
  ipcRenderer.on(DESKTOP_IPC.browserAgentHandoff, (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || !('lease' in request) || !('message' in request)
      || typeof request.lease !== 'string' || typeof request.message !== 'string') return
    for (const listener of [...handoffListeners]) listener(request.lease, request.message)
  })
  return {
    onHandoff: (listener) => {
      handoffListeners.add(listener)
      return () => { handoffListeners.delete(listener) }
    },
    resumeAgent: lease => ipcRenderer.invoke(DESKTOP_IPC.browserAgentResume, lease) as Promise<void>,
    acquire: workspace => ipcRenderer.invoke(DESKTOP_IPC.browserAcquire, workspace) as ReturnType<DesktopBrowserBridge['acquire']>,
    release: lease => ipcRenderer.invoke(DESKTOP_IPC.browserRelease, lease) as Promise<void>,
    bindAgent: (lease, sessionId) => ipcRenderer.invoke(DESKTOP_IPC.browserAgentBind, lease, sessionId) as Promise<void>,
    unbindAgent: lease => ipcRenderer.invoke(DESKTOP_IPC.browserAgentUnbind, lease) as Promise<void>,
    onOpenRequested(lease, listener) {
      let callbacks = listeners.get(lease)
      if (callbacks === undefined) { callbacks = new Set(); listeners.set(lease, callbacks) }
      callbacks.add(listener)
      return () => {
        callbacks.delete(listener)
        if (callbacks.size === 0 && listeners.get(lease) === callbacks) listeners.delete(lease)
      }
    },
  }
}
