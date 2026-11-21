/** Type-only Electron bridge declarations shared by the desktop shell and browser provider. */
import type { Branded } from '@ocean/ocean-brand'

/** Main-issued identity of one guest reservation. */
export type DesktopBrowserLeaseId = Branded<'DesktopBrowserLeaseId'>

/** A guest's approved, process-local storage partition. */
export interface DesktopBrowserReservation {
  readonly lease: DesktopBrowserLeaseId
  readonly partition: string
}

/** Main-approved request to open an HTTP(S) page from an existing guest. */
export interface DesktopBrowserOpenRequest {
  readonly lease: DesktopBrowserLeaseId
  readonly url: string
}

/** Origin-scoped operations; no Electron objects or arbitrary IPC cross this interface. */
export interface DesktopBrowserBridge {
  /** @param workspace - resolved storage account. @returns one approved guest reservation. */
  acquire(workspace: string): Promise<DesktopBrowserReservation>
  /** @param lease - the caller's reservation. @returns after its guest has been destroyed. */
  release(lease: DesktopBrowserLeaseId): Promise<void>
  /** @param lease - originating guest. @param listener - approved URL consumer. @returns unsubscribe callback. */
  onOpenRequested(lease: DesktopBrowserLeaseId, listener: (url: string) => void): () => void
  /** @param listener - one Agent handoff for a lease. @returns unsubscribe callback. */
  onHandoff(listener: (lease: string, message: string) => void): () => void
  /**
   * Let the Session's Agent read and act on one mounted guest.
   * @param lease - the caller's reservation.
   * @param sessionId - exact Session that owns the requesting Agent.
   * @returns after the main process records the binding.
   */
  bindAgent(lease: DesktopBrowserLeaseId, sessionId: string): Promise<void>
  /**
   * Release a handoff so the Agent may act on the tab again.
   * @param lease - the caller's reservation.
   */
  resumeAgent(lease: DesktopBrowserLeaseId): Promise<void>
  /**
   * Revoke Agent access to one guest. Idempotent.
   * @param lease - the caller's reservation.
   */
  unbindAgent(lease: DesktopBrowserLeaseId): Promise<void>
}
