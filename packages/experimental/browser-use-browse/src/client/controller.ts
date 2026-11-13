/** Human-only browser setup drafts. No read or save contacts the relay. */
import { createSnapshotStore, type SnapshotStore } from '@ocean/ocean-client-store'
import type { RemoteResult } from '@ocean/ocean-typert-protocol'

/** Only the token file path is exposed; never its contents. */
export interface SetupConfiguration { endpoint: string; tokenFile: string; browser: string; allowedOrigins: string[] }
/** Host observation is not proof that a browser is connected. */
export interface SetupStatus {
  revision: string
  enabled: boolean
  writable: boolean
  blocked: boolean
  configuration: SetupConfiguration
  connection: 'not-tested'
}
/** Explicit user-approved settings sent to the host. */
export interface SetupSave extends SetupConfiguration { revision: string
  enabled: boolean }
/** Minimal transport face, independently testable without a real account. */
export interface SetupRemote {
  /** Read saved settings without contacting the relay.
   * @returns host status or a transport failure.
   */
  status(): Promise<RemoteResult<SetupStatus>>
  /** Persist explicitly confirmed settings after stopping previous browser sessions.
   * @param input - complete settings and the observed revision.
   * @returns saved status or a failure that requires an explicit refresh.
   */
  save(input: SetupSave): Promise<RemoteResult<SetupStatus>>
}
/** Plain-text form data
  allowlist is one exact HTTPS origin per line. */
export interface SetupDraft { endpoint: string
  tokenFile: string
  browser: string
  origins: string
  enabled: boolean }
/** UI state separates a saved configuration from unverified browser connectivity. */
export interface SetupView {
  status: SetupStatus | null
  draft: SetupDraft
  busy: boolean
  confirming: boolean
  error: 'read' | 'save' | null
  saved: boolean
}
/** Slot-bound actions and state. */
export interface SetupFace {
  hooks: { browserSetup: SnapshotStore<SetupView> }
  refresh: () => void
  edit: (field: keyof SetupDraft, value: string | boolean) => void
  requestSave: () => void
  cancelSave: () => void
  confirmSave: () => void
}
const empty: SetupDraft = { endpoint: 'http://127.0.0.1:19988', tokenFile: '', browser: '', origins: '', enabled: false }
function draft(status: SetupStatus): SetupDraft {
  return { ...status.configuration, origins: status.configuration.allowedOrigins.join('\n'), enabled: status.enabled }
}

/** Serializes writes and ignores stale/disposed reads, with no automatic write or retry. */
export class SetupController {
  /** Saved settings, editable draft and pending confirmation shared by bound views. */
  readonly state = createSnapshotStore<SetupView>({ status: null, draft: empty, busy: false, confirming: false, error: null, saved: false })
  private closed = false
  private epoch = 0
  constructor(private readonly remote: SetupRemote) {}
  /** Bind user actions. Only confirmSave is permitted to mutate host configuration.
   * @returns slot actions sharing this controller's state and lifetime.
   */
  face(): SetupFace {
    return { hooks: { browserSetup: this.state }, refresh: () => { void this.refresh() },
      edit: (field, value) => {
        const current = this.state.getSnapshot()
        if (this.closed || current.busy || !current.status?.writable || current.status.blocked) return
        if ((field === 'enabled') !== (typeof value === 'boolean')) return
        this.state.update((state) => {
          if (field === 'enabled') state.draft.enabled = value as boolean
          else state.draft[field] = value as string
          state.confirming = false; state.saved = false
        })
      },
      requestSave: () => {
        const state = this.state.getSnapshot()
        if (!this.closed && !state.busy && state.status?.writable && !state.status.blocked) {
          this.state.update((value) => { value.confirming = true })
        }
      },
      cancelSave: () => { if (!this.closed) this.state.update((state) => { state.confirming = false }) },
      confirmSave: () => { void this.save() },
    }
  }
  /** Stop publication and invalidate all confirmation and in-flight reads. */
  dispose(): void { this.closed = true; this.epoch++ }
  private current(epoch: number): boolean { return !this.closed && epoch === this.epoch }
  private async refresh(): Promise<void> {
    if (this.closed || this.state.getSnapshot().busy) return
    const epoch = ++this.epoch
    this.state.update((state) => { state.busy = true; state.confirming = false; state.error = null; state.saved = false })
    try {
      const result = await this.remote.status()
      if (!this.current(epoch)) return
      if (!result.ok) throw new Error('read failed')
      this.state.update((state) => { state.status = result.value; state.draft = draft(result.value); state.busy = false })
    } catch {
      if (this.current(epoch)) this.state.update((state) => { state.busy = false; state.status = null; state.error = 'read' })
    }
  }
  private async save(): Promise<void> {
    const state = this.state.getSnapshot()
    if (this.closed || state.busy || !state.confirming || !state.status?.writable || state.status.blocked) return
    const input: SetupSave = { revision: state.status.revision, endpoint: state.draft.endpoint.trim(),
      tokenFile: state.draft.tokenFile.trim(), browser: state.draft.browser.trim(), enabled: state.draft.enabled,
      allowedOrigins: state.draft.origins.split('\n').map(origin => origin.trim()).filter(Boolean) }
    const epoch = ++this.epoch
    this.state.update((value) => { value.busy = true; value.confirming = false; value.error = null; value.saved = false })
    try {
      const result = await this.remote.save(input)
      if (!this.current(epoch)) return
      if (!result.ok) throw new Error('save failed')
      this.state.update((value) => {
        value.status = result.value; value.draft = draft(result.value); value.busy = false; value.saved = true
      })
    } catch {
      // Do not retain a writable stale revision after an uncertain write. Refresh is explicit.
      if (this.current(epoch)) this.state.update((value) => { value.status = null; value.busy = false; value.error = 'save' })
    }
  }
}
