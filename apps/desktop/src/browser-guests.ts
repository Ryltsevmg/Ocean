/** Main-process ownership and fixed isolation policy for Sidebar webview guests. */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { app, session, type BrowserWindow, type Session, type WebContents } from 'electron'
import type { DesktopBrowserLeaseId, DesktopBrowserOpenRequest, DesktopBrowserReservation } from '@ocean/ocean-client-ui-sidebar-browser/types'
import type { BrowserAgentMethod, BrowserAgentResult } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'
import { AGENT_METHODS, BrowserAgentError, captureBrowserScreenshot, executeBrowserAgent, watchDialogs, type DialogWatch } from './browser-agent.ts'
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
  /** Scoped CDP watch owned by the lease; present only while its Agent binding is active. */
  dialogWatch?: DialogWatch | undefined
  /** Files the Agent-shared guest downloaded while shared; empty for private tabs. */
  downloads: DownloadRecord[]
  /** The person holds the tab until they resume the Agent. */
  handedOff?: { readonly resolve: () => void } | undefined
}

/** One captured download; the saved file lives under this application's userData. */
interface DownloadRecord {
  filename: string
  path: string
  state: 'saving' | 'done' | 'interrupted'
}


/** Upper bound on tabs one Session may share at once. */
const MAX_SHARED_TABS = 8

/** One bounded failure for a command whose delivery itself broke. */
export function browserFallbackResult(requestId: number): BrowserAgentResult {
  return { type: 'browser-agent-result', requestId, ok: false,
    error: { code: 'BROWSER_ACTION_FAILED', message: 'The browser action failed; inspect the page before continuing.' } }
}

/** Build one result whose request id is filled in by the IPC dispatcher. */
function agentFailure(code: string, message: string): BrowserAgentResult {
  return { type: 'browser-agent-result', requestId: 0, ok: false, error: { code, message } }
}

/** Owns workspace storage partitions independently from individual tab guests. */
export class DesktopBrowserGuests {
  private readonly partitions = new Map<string, string>()
  private readonly leases = new Map<DesktopBrowserLeaseId, GuestLease>()
  private readonly agentSessions = new Map<string, DesktopBrowserLeaseId[]>()
  private readonly guestLeases = new Map<number, GuestLease>()

  /** @param hostUrl - current authenticated OCEAN Host, which guests cannot request.
   * @param ownerSend - delivers one handoff notice to the owning application window. */
  constructor(private readonly hostUrl: () => string | undefined,
    private readonly ownerSend: (request: { lease: DesktopBrowserLeaseId; message: string }) => void = () => {}) {}

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
    this.leases.set(lease, { owner, partition, attached: false, downloads: [] })
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
    lease.dialogWatch?.dispose()
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
    const shared = this.agentSessions.get(sessionId) ?? []
    if (shared.includes(key)) return
    if (lease.guest !== undefined && !lease.guest.isDestroyed() && lease.dialogWatch === undefined) {
      lease.dialogWatch = watchDialogs(lease.guest)
    }
    if (shared.length >= MAX_SHARED_TABS) throw new Error('desktop browser: this Session already shares the maximum number of tabs')
    lease.agentSessionId = sessionId
    // The newest shared tab becomes active; browser_tab_select switches.
    this.agentSessions.set(sessionId, [key, ...shared])
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

  /** Release a handoff so the Agent may act again. Idempotent.
   * @param id - lease received over IPC.
   */
  resumeAgent(id: unknown): void {
    if (typeof id !== 'string') return
    const lease = this.leases.get(id as DesktopBrowserLeaseId)
    const handoff = lease?.handedOff
    if (lease !== undefined && handoff !== undefined) {
      delete lease.handedOff
      handoff.resolve()
    }
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
    const shared = this.agentSessions.get(sessionId)
    if (shared === undefined) return agentFailure('BROWSER_NOT_SHARED',
      'No Browser tab is shared with this agent. Open the Browser panel and enable Share with agent.')
    if (method === 'tabs') {
      const rows: string[] = []
      for (const [index, key] of shared.entries()) {
        const guest = this.leases.get(key)?.guest
        const label = guest === undefined || guest.isDestroyed() ? '(closed)' : `${guest.getTitle() || '(untitled)'} ${guest.getURL() || ''}`.trim()
        rows.push(`${index === 0 ? '*' : ' '} ${String(index)} ${label}`)
      }
      return { type: 'browser-agent-result', requestId: 0, ok: true,
        text: `shared tabs (* active):\n${rows.join('\n')}` }
    }
    if (method === 'tab_select') {
      const index = typeof args.index === 'number' && Number.isSafeInteger(args.index) ? args.index : -1
      const key = shared[index]
      if (key === undefined) return agentFailure('BROWSER_TAB_INVALID', 'No shared tab at that index; call browser_tabs.')
      this.agentSessions.set(sessionId, [key, ...shared.filter(other => other !== key)])
      return { type: 'browser-agent-result', requestId: 0, ok: true, text: `active tab ${String(index)}` }
    }
    const key = shared[0] as DesktopBrowserLeaseId
    const lease = this.leases.get(key)
    if (method !== 'handoff' && lease?.handedOff !== undefined) {
      return agentFailure('BROWSER_HANDOFF_ACTIVE', 'The person is working in the tab; wait for browser_handoff to return.')
    }
    if (method === 'handoff') {
      if (lease === undefined) return agentFailure('BROWSER_NOT_READY', 'The active shared tab is not ready.')
      if (lease.handedOff !== undefined) return agentFailure('BROWSER_HANDOFF_ACTIVE', 'A handoff is already waiting for the person.')
      const message = typeof args.message === 'string' ? args.message.slice(0, 1000) : ''
      const settled = Promise.withResolvers<void>()
      lease.handedOff = { resolve: settled.resolve }
      this.ownerSend({ lease: key, message })
      const answered = await Promise.race([
        settled.promise.then(() => true),
        new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => { resolve(false) }, 300_000)
          timer.unref()
        }),
      ])
      delete lease.handedOff
      const guest = lease.guest
      if (!answered || guest === undefined || guest.isDestroyed()) {
        return agentFailure('BROWSER_HANDOFF_TIMEOUT', 'The person did not resume the tab within five minutes.')
      }
      return { type: 'browser-agent-result', requestId: 0, ok: true, text: await executeBrowserAgent(guest, 'snapshot', {}) }
    }
    if (method === 'console' || method === 'network') {
      const read = lease?.dialogWatch?.[method]
      if (read === undefined) return agentFailure('BROWSER_NOT_READY', 'The active shared tab is not ready; select another tab with browser_tab_select.')
      return { type: 'browser-agent-result', requestId: 0, ok: true, text: read() }
    }
    if (method === 'downloads') {
      const rows = (lease?.downloads ?? []).map((item, index) =>
        `${String(index)} ${item.state} ${item.filename} ${item.path}`)
      return { type: 'browser-agent-result', requestId: 0, ok: true,
        text: rows.length === 0 ? 'no downloads' : `downloads of the active tab:\n${rows.join('\n')}` }
    }
    const guest = lease?.guest
    if (lease === undefined || guest === undefined || guest.isDestroyed()) {
      return agentFailure('BROWSER_NOT_READY', 'The active shared tab is not ready; select another tab with browser_tab_select.')
    }
    let result: BrowserAgentResult = agentFailure('BROWSER_ACTION_FAILED', 'The browser action failed.')
    const previous = lease.agentTail ?? Promise.resolve()
    const next = previous.catch(() => {}).then(async () => {
      const current = this.leases.get(key)
      if (current?.guest !== guest || guest.isDestroyed()) {
        result = agentFailure('BROWSER_GUEST_CLOSED', 'The shared tab is closed.')
        return
      }
      const watch = current.dialogWatch
      if (method !== 'dialog' && watch?.pending() !== undefined) {
        result = agentFailure('BROWSER_DIALOG_PENDING',
          'A JavaScript dialog is open; answer it with browser_dialog before acting.')
        return
      }
      if (method === 'dialog') {
        const action = args.action
        if (action === 'read') {
          const pending = watch?.pending()
          result = { type: 'browser-agent-result', requestId: 0, ok: true,
            text: pending === undefined ? 'no dialog' : JSON.stringify(pending) }
          return
        }
        if (action !== 'accept' && action !== 'dismiss') {
          result = agentFailure('BROWSER_DIALOG_ACTION_INVALID', 'The dialog action must be read, accept, or dismiss.')
          return
        }
        if (watch === undefined) {
          result = agentFailure('BROWSER_DIALOG_UNAVAILABLE', 'Dialog control is unavailable for this tab.')
          return
        }
        try {
          await watch.answer(action, typeof args.promptText === 'string' ? args.promptText : undefined)
          result = { type: 'browser-agent-result', requestId: 0, ok: true, text: await executeBrowserAgent(guest, 'snapshot', {}) }
        } catch (error) {
          result = error instanceof BrowserAgentError
            ? agentFailure(error.code, error.message)
            : agentFailure('BROWSER_ACTION_FAILED', 'The dialog answer failed.')
        }
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
    if (lease.dialogWatch !== undefined) {
      lease.dialogWatch.dispose()
      delete lease.dialogWatch
    }
    lease.agentSessionId = undefined
    if (sessionId === undefined) return
    const shared = this.agentSessions.get(sessionId)
    if (shared === undefined) return
    const rest = shared.filter(key => key !== id)
    if (rest.length === 0) this.agentSessions.delete(sessionId)
    else this.agentSessions.set(sessionId, rest)
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
        webviewTag: false, plugins: false, navigateOnDragDrop: false, disableDialogs: false,
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
        this.guestLeases.set(guest.id, lease)
        lease.releaseInput = attachInput(guest, id)
        guest.once('destroyed', () => {
          lease.releaseInput?.()
          lease.dialogWatch?.dispose()
          this.guestLeases.delete(guest.id)
          if (attachedLease !== undefined) this.forgetAgent(attachedLease, lease)
          this.leases.delete(id)
        })
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
    // One partition-level handler instead of a per-guest listener: webviews in the same
    // workspace share the Session object, and each new guest must not stack listeners.
    browserSession.on('will-download', (event, item, source) => {
      const lease = this.guestLeases.get(source.id)
      const shared = lease?.agentSessionId
      if (lease === undefined || shared === undefined) {
        // Sidebar browsing never writes to disk: private tabs keep downloads blocked.
        event.preventDefault()
        return
      }
      const savePath = join(app.getPath('userData'), 'sidebar-browser-downloads', shared, item.getFilename())
      item.setSavePath(savePath)
      const record: DownloadRecord = { filename: item.getFilename(), path: savePath, state: 'saving' }
      lease.downloads.push(record)
      item.once('done', (_doneEvent, state) => { record.state = state === 'completed' ? 'done' : 'interrupted' })
    })
    browserSession.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false) })
    browserSession.setPermissionCheckHandler(() => false)
    browserSession.setDevicePermissionHandler(() => false)
    browserSession.setDisplayMediaRequestHandler((_request, callback) => { callback({}) })
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
