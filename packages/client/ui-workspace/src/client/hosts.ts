/** Desktop Host navigation and publication owned by the Workspace adapter. */
import { createSnapshotStore } from '@ocean/ocean-client-store'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@ocean/ocean-client-ui-slots'
import type { SessionListState } from '@ocean/ocean-api-session-controller/client'
import type { SessionPendingInteractionBase } from '@ocean/ocean-client-ui-session/client'
import type { SessionId } from '@ocean/ocean-session/types'

/** One independently connected Host visible to this renderer. */
export interface HostEntry {
  readonly id: string
  readonly label: string
  readonly sessions?: readonly { readonly id: string; readonly title: string }[]
  readonly pendingApprovals?: number
  readonly pendingQuestions?: number
}

/** Monotonic main-process navigation snapshot. */
export interface HostSelection {
  readonly revision: number
  readonly publicationRevision: number
  readonly label: string
  readonly selected: string
  readonly entries: readonly HostEntry[]
}

/** Session metadata published by one renderer, without cross-Host identifiers. */
export interface HostPublication {
  readonly revision: number
  readonly sessions: readonly { readonly id: string; readonly title: string }[]
  readonly pendingApprovals: number
  readonly pendingQuestions: number
}

/** Narrow Electron preload API; every mutation is authorized by the main process. */
export interface DesktopHostsBridge {
  read(this: void): Promise<HostSelection>
  select(this: void, id: string): Promise<void>
  openSession(this: void, hostId: string, sessionId: string): Promise<void>
  subscribe(this: void, listener: () => void): () => void
  publishSessions(this: void, value: HostPublication): Promise<void>
  onOpenOwnedSession(this: void, listener: (id: string) => void): () => void
}

interface HostView {
  readonly selection: HostSelection | undefined
  readonly address: string | undefined
  readonly busy: boolean
  readonly error: 'load' | 'select' | 'publish' | undefined
}

/** Private sources and actions for the Host navigation entry. */
export interface HostNavigationInjected {
  hooks: { hosts: HostObservable<HostView> }
  select(hostId: string, sessionId?: string): void
  retry(): void
}

/** Framework-composed Host control props. */
export type HostNavigationProps = PropsRuntime<'sidebar.hosts'> & InjectFace<HostNavigationInjected> & PropsLocale<'workspace'>

/**
 * Bind the preload transport to one plugin lifetime, rejecting obsolete reads.
 * @param bridge - Desktop API, absent in ordinary browser clients.
 * @param address - Browser device address captured by the owning plugin at startup.
 * @param retryPublication - Retry publication after a visible IPC failure.
 * @returns Private observable/actions, lifetime installer and publication status reporters.
 */
export function createHostNavigation(bridge: DesktopHostsBridge | undefined, address: string | undefined, retryPublication: () => void): {
  injected: HostNavigationInjected
  publicationFailed: () => void
  publicationSucceeded: () => void
  start: () => () => void
} {
  const state = createSnapshotStore<HostView>({ address, selection: undefined, error: undefined, busy: false })
  let active = false
  let request = 0
  let failedNavigation: { id: string; sessionId: string | undefined } | undefined
  const failures = new Set<NonNullable<HostView['error']>>()
  const update = (value: Partial<Omit<HostView, 'error'>> = {}): void => {
    const error = failures.has('select') ? 'select' : failures.has('publish') ? 'publish' : failures.has('load') ? 'load' : undefined
    state.set({ ...state.getSnapshot(), ...value, error })
  }
  const refresh = (): void => {
    if (bridge === undefined || !active) return
    const current = ++request
    void bridge.read().then((selection) => {
      if (!active || current !== request || selection.revision < (state.getSnapshot().selection?.revision ?? -1)) return
      failures.delete('load')
      update({ selection })
    }, () => {
      if (active && current === request) { failures.add('load'); update() }
    })
  }
  const injected: HostNavigationInjected = {
    hooks: { hosts: state },
    retry: () => {
      if (failedNavigation !== undefined) injected.select(failedNavigation.id, failedNavigation.sessionId)
      else { refresh(); retryPublication() }
    },
    select: (id, sessionId) => {
      if (bridge === undefined || !active || state.getSnapshot().busy) return
      failedNavigation = undefined
      failures.delete('select')
      update({ busy: true })
      void (sessionId === undefined ? bridge.select(id) : bridge.openSession(id, sessionId)).then(() => {
        if (!active) return
        update({ busy: false })
        refresh()
      }, () => {
        if (active) {
          failedNavigation = { id, sessionId }
          failures.add('select')
          update({ busy: false })
        }
      })
    },
  }
  return {
    injected,
    publicationFailed: (): void => { if (active) { failures.add('publish'); update() } },
    publicationSucceeded: (): void => { if (active) { failures.delete('publish'); update() } },
    start: (): (() => void) => {
      active = true
      const stop = bridge?.subscribe(refresh)
      refresh()
      return () => { active = false; ++request; stop?.() }
    },
  }
}

/**
 * Publish coalesced navigation and every pending request, with at most one IPC in flight.
 * @param options - Sources from this Host and its preload endpoint.
 * @returns Retry action and disposer that prevents queued publications and releases listeners.
 */
export function publishHostSessions(options: {
  bridge: DesktopHostsBridge
  sessions: HostObservable<SessionListState>
  archived: HostObservable<readonly SessionId[]>
  pending: HostObservable<readonly SessionPendingInteractionBase[]>
  failed: () => void
  succeeded: () => void
}): { retry: () => void; dispose: () => void } {
  let active = true
  let queued = false
  let sending = false
  let revision = 0
  let initialized = false
  const isActive = (): boolean => active
  const isQueued = (): boolean => queued
  let last: string | undefined
  const flush = async (): Promise<void> => {
    if (!isActive() || sending) return
    queued = false
    sending = true
    try {
      if (!initialized) {
        const snapshot = await options.bridge.read()
        if (!isActive()) return
        revision = Math.max(0, snapshot.publicationRevision)
        initialized = true
      }
      const { ids, byId, phase } = options.sessions.getSnapshot()
      if (phase !== 'ready') return
      const archived = new Set(options.archived.getSnapshot())
      const sessions = ids.flatMap((id) => {
        const row = byId[id]
        return row === undefined || row.blank || row.parentId !== undefined || archived.has(id)
          ? [] : [{ id, title: row.displayTitle.slice(0, 256) }]
      }).slice(0, 50)
      const pending = options.pending.getSnapshot()
      const value = { sessions,
        pendingApprovals: pending.filter(row => row.kind === 'approval' || row.kind === 'plan-review').length,
        pendingQuestions: pending.filter(row => row.kind === 'question').length,
      }
      const serialized = JSON.stringify(value)
      if (last === serialized) return
      await options.bridge.publishSessions({ ...value, revision: ++revision })
      last = serialized
      if (isActive()) options.succeeded()
    } catch (_error) {
      // A rejected IPC response does not establish whether main accepted the publication.
      last = undefined
      if (isActive()) options.failed()
    } finally {
      sending = false
      if (isActive() && isQueued()) queueMicrotask(() => { void flush() })
    }
  }
  const schedule = (): void => {
    if (!active || queued) return
    queued = true
    queueMicrotask(() => { void flush() })
  }
  const stops = [options.sessions.subscribe(schedule), options.archived.subscribe(schedule), options.pending.subscribe(schedule)]
  schedule()
  return { retry: schedule, dispose: () => { active = false; for (const stop of stops) stop() } }
}
