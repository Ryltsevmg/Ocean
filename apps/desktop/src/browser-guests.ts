/** Main-process ownership and fixed isolation policy for Sidebar webview guests. */
import { randomUUID } from 'node:crypto'
import { app, session, type BrowserWindow, type Session, type WebContents } from 'electron'
import type { DesktopBrowserLeaseId, DesktopBrowserOpenRequest, DesktopBrowserReservation } from '@ocean/ocean-client-ui-sidebar-browser/types'
import type { BrowserAgentMethod, BrowserAgentResult } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'
import { BrowserAgentError, captureBrowserScreenshot, executeBrowserAgent } from './browser-agent.ts'
import { DESKTOP_IPC } from './ipc.ts'

interface GuestLease {
  readonly owner: WebContents
  readonly partition: string
  attached: boolean
  guest?: WebContents
  releaseInput?: () => void
  /** Exact Session whose Agent may read and act on this guest. */
  agentSessionId?: string | undefined
  /** Serializes Agent commands for this guest in arrival order. */
  agentTail?: Promise<void>
}

const AGENT_METHODS: readonly BrowserAgentMethod[] = ['info', 'snapshot', 'click', 'fill', 'navigate', 'back', 'forward', 'reload', 'screenshot']

/** Build one result whose request id is filled in by the IPC dispatcher. */
function agentFailure(code: string, message: string): BrowserAgentResult {
  return { type: 'browser-agent-result', requestId: 0, ok: false, error: { code, message } }
}

/** Owns workspace storage partitions independently from individual tab guests. */
export class DesktopBrowserGuests {
  private readonly partitions = new Map<string, string>()
  private readonly leases = new Map<DesktopBrowserLeaseId, GuestLease>()
  private readonly agentSessions = new Map<string, DesktopBrowserLeaseId>()

  /** @param hostUrl - current authenticated OCEAN Host, which guests cannot request. */
  constructor(private readonly hostUrl: () => string | undefined) {}

  /**
   * Reserve one guest in a workspace's process-lifetime partition.
   * @param owner - authenticated primary application WebContents.
   * @param workspace - workspace identity received over IPC.
   * @returns opaque lease and the partition approved for it.
   */
  acquire(owner: WebContents, workspace: unknown): DesktopBrowserReservation {
    if (typeof workspace !== 'string' || workspace.length === 0 || workspace.length > 4096) {
      throw new Error('desktop browser: a workspace storage identity is required')
    }
    let partition = this.partitions.get(workspace)
    if (partition === undefined) {
      partition = `ocean-sidebar-browser-${randomUUID()}`
      this.configureSession(session.fromPartition(partition))
      this.partitions.set(workspace, partition)
    }
    const lease = randomUUID() as DesktopBrowserLeaseId
    this.leases.set(lease, { owner, partition, attached: false })
    return { lease, partition }
  }

  /**
   * Release only a lease issued to this application window; workspace storage survives.
   * @param owner - authenticated IPC sender.
   * @param id - lease received over IPC.
   */
  async release(owner: WebContents, id: unknown): Promise<void> {
    if (typeof id !== 'string') throw new Error('desktop browser: invalid guest lease')
    const key = id as DesktopBrowserLeaseId
    const lease = this.leases.get(key)
    if (lease === undefined) return
    if (lease.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
    lease.releaseInput?.()
    this.forgetAgent(key, lease)
    this.leases.delete(key)
    const guest = lease.guest
    if (guest !== undefined && !guest.isDestroyed()) {
      const destroyed = new Promise<void>((resolve) => { guest.once('destroyed', resolve) })
      guest.close({ waitForBeforeUnload: false })
      await destroyed
    }
  }

  /**
   * Let one Session's Agent read and act on a mounted guest.
   * @param owner - authenticated IPC sender.
   * @param id - lease received over IPC.
   * @param sessionId - exact Session that owns the requesting Agent.
   */
  bindAgent(owner: WebContents, id: unknown, sessionId: unknown): void {
    if (typeof id !== 'string' || typeof sessionId !== 'string' || sessionId.length === 0 || sessionId.length > 256) {
      throw new Error('desktop browser: invalid Agent binding')
    }
    const key = id as DesktopBrowserLeaseId
    const lease = this.leases.get(key)
    if (lease === undefined || lease.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
    const previous = this.agentSessions.get(sessionId)
    if (previous !== undefined && previous !== key) {
      throw new Error('desktop browser: this Session already shares another tab')
    }
    lease.agentSessionId = sessionId
    this.agentSessions.set(sessionId, key)
  }

  /**
   * Revoke Agent access to one mounted guest. Idempotent.
   * @param owner - authenticated IPC sender.
   * @param id - lease received over IPC.
   */
  unbindAgent(owner: WebContents, id: unknown): void {
    if (typeof id !== 'string') return
    const key = id as DesktopBrowserLeaseId
    const lease = this.leases.get(key)
    if (lease === undefined) return
    if (lease.owner !== owner) throw new Error('desktop browser: guest belongs to another window')
    this.forgetAgent(key, lease)
  }

  /**
   * Run one bounded command for the Session's shared guest.
   * @param sessionId - Session whose Agent issued the command.
   * @param method - validated operation name.
   * @param args - JSON arguments validated by the executor.
   * @returns a model-facing observation or a stable failure.
   */
  async executeAgent(sessionId: string, method: BrowserAgentMethod,
    args: Readonly<Record<string, string | number>>): Promise<BrowserAgentResult> {
    if (!AGENT_METHODS.includes(method)) {
      return { type: 'browser-agent-result', requestId: 0, ok: false,
        error: { code: 'BROWSER_METHOD_UNKNOWN', message: 'Unknown browser operation.' } }
    }
    const key = this.agentSessions.get(sessionId)
    if (key === undefined) return agentFailure('BROWSER_NOT_SHARED',
      'No Browser tab is shared with this agent. Open the Browser panel and enable Share with agent.')
    const lease = this.leases.get(key)
    const guest = lease?.guest
    if (lease === undefined || guest === undefined || guest.isDestroyed()) {
      return agentFailure('BROWSER_NOT_READY', 'The shared tab is not ready yet; try again after it finishes loading.')
    }
    let result: BrowserAgentResult = agentFailure('BROWSER_ACTION_FAILED', 'The browser action failed.')
    const previous = lease.agentTail ?? Promise.resolve()
    const next = previous.catch(() => {}).then(async () => {
      const current = this.leases.get(key)
      if (current?.guest !== guest || guest.isDestroyed()) {
        result = agentFailure('BROWSER_GUEST_CLOSED', 'The shared tab is closed.')
        return
      }
      try {
        const observation = method === 'screenshot'
          ? await captureBrowserScreenshot(guest, args)
          : { text: await executeBrowserAgent(guest, method, args) }
        result = {
          type: 'browser-agent-result', requestId: 0, ok: true, text: observation.text,
          ...'image' in observation ? { image: observation.image } : {},
        }
      } catch (error) {
        result = error instanceof BrowserAgentError
          ? agentFailure(error.code, error.message)
          : agentFailure('BROWSER_ACTION_FAILED', 'The browser action failed; inspect the page before continuing.')
      }
    })
    lease.agentTail = next.then(() => {}, () => {})
    await next
    return result
  }

  /** Clear one lease's Agent binding without touching the guest. */
  private forgetAgent(id: DesktopBrowserLeaseId, lease: GuestLease): void {
    const sessionId = lease.agentSessionId
    lease.agentSessionId = undefined
    if (sessionId !== undefined && this.agentSessions.get(sessionId) === id) this.agentSessions.delete(sessionId)
  }

  /**
   * Install attachment checks before the application document can create a webview.
   * @param window - primary application window.
   * @param attachInput - attaches native input after guest ownership is verified and returns its disposer.
   */
  bind(window: BrowserWindow, attachInput: (guest: WebContents, name: DesktopBrowserLeaseId) => () => void): void {
    const owner = window.webContents
    owner.on('will-attach-webview', (event, preferences, params) => {
      const id = typeof params.src === 'string' && params.src.startsWith('about:blank#')
        ? params.src.slice('about:blank#'.length) : ''
      const lease = this.leases.get(id as DesktopBrowserLeaseId)
      if (lease === undefined || lease.owner !== owner || lease.attached || params.partition !== lease.partition) {
        event.preventDefault()
        return
      }
      lease.attached = true
      // Keep Electron's allowpopups dispatch flag; the guest handler still denies native windows.
      for (const key of Object.keys(preferences)) {
        if (key !== 'disablePopups') Reflect.deleteProperty(preferences, key)
      }
      Object.assign(preferences, {
        partition: lease.partition,
        nodeIntegration: false, nodeIntegrationInWorker: false, nodeIntegrationInSubFrames: false,
        contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false,
        webviewTag: false, plugins: false, navigateOnDragDrop: false, disableDialogs: true,
        devTools: !app.isPackaged,
      })
      params.httpreferrer = ''
    })
    owner.on('did-attach-webview', (_event, guest) => {
      let attachedLease: DesktopBrowserLeaseId | undefined
      // The first document is an inert about:blank carrying the approved lease.
      // Bind on the main-process event before the renderer can navigate the ready guest.
      guest.once('dom-ready', () => {
        const url = guest.getURL()
        const id = (url.startsWith('about:blank#') ? url.slice('about:blank#'.length) : '') as DesktopBrowserLeaseId
        const lease = this.leases.get(id)
        if (lease === undefined || lease.owner !== owner || lease.guest !== undefined) {
          guest.close({ waitForBeforeUnload: false })
          return
        }
        lease.guest = guest
        attachedLease = id
        lease.releaseInput = attachInput(guest, id)
        guest.once('destroyed', () => { lease.releaseInput?.(); if (attachedLease !== undefined) this.forgetAgent(attachedLease, lease); this.leases.delete(id) })
      })
      guest.setWindowOpenHandler(({ url, postBody }) => {
        const lease = attachedLease === undefined ? undefined : this.leases.get(attachedLease)
        if (attachedLease !== undefined && lease?.guest === guest && lease.owner === owner && !owner.isDestroyed()
          && postBody === undefined && this.allowedNavigation(url)) {
          const request: DesktopBrowserOpenRequest = { lease: attachedLease, url: new URL(url).href }
          owner.send(DESKTOP_IPC.browserOpenRequested, request)
        }
        return { action: 'deny' }
      })
      guest.on('will-frame-navigate', (event) => {
        if (event.isMainFrame && !this.allowedNavigation(event.url)) event.preventDefault()
      })
      guest.on('will-redirect', (event, url, _inPlace, mainFrame) => {
        if (mainFrame && !this.allowedNavigation(url)) event.preventDefault()
      })
      guest.on('will-attach-webview', (event) => { event.preventDefault() })
      guest.on('login', (event, _details, _authInfo, callback) => { event.preventDefault(); callback() })
    })
    const releaseAll = (): void => {
      for (const [id, lease] of this.leases) {
        if (lease.owner === owner) void this.release(owner, id).catch((error: unknown) => { console.error(error) })
      }
    }
    owner.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
      if (mainFrame && !inPlace) releaseAll()
    })
    owner.on('render-process-gone', releaseAll)
    owner.once('destroyed', releaseAll)
  }

  private configureSession(browserSession: Session): void {
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false) })
    browserSession.setPermissionCheckHandler(() => false)
    browserSession.setDevicePermissionHandler(() => false)
    browserSession.setDisplayMediaRequestHandler((_request, callback) => { callback({}) })
    browserSession.on('will-download', (event) => { event.preventDefault() })
    browserSession.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url)
      const network = ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)
      callback({ cancel: network
        ? url.username !== '' || url.password !== '' || this.isApplicationHost(url)
        : !['about:', 'data:', 'blob:'].includes(url.protocol) })
    })
  }

  private allowedNavigation(value: string): boolean {
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && url.username === '' && url.password === ''
      && !this.isApplicationHost(url)
  }

  private isApplicationHost(url: URL): boolean {
    const value = this.hostUrl()
    if (value === undefined) return false
    const host = new URL(value)
    return url.port === host.port
      && (url.hostname === host.hostname || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  }
}
