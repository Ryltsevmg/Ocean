/** Host metadata ordering, bounded publication and plugin teardown. */
import { describe, expect, it, vi } from 'vitest'
import { createSnapshotStore } from '@ocean/ocean-client-store'
import type { SessionListState, SessionSummary } from '@ocean/ocean-api-session-controller/client'
import type { SessionPendingInteractionBase } from '@ocean/ocean-client-ui-session/client'
import type { SessionId } from '@ocean/ocean-session/types'
import { createHostNavigation, publishHostSessions, type DesktopHostsBridge, type HostSelection } from '../src/client/hosts.ts'

const selection = (revision = 1): HostSelection => ({
  revision, publicationRevision: -1, label: 'Hosts', selected: 'local', entries: [{ id: 'local', label: 'Local' }],
})
function fixture() {
  let change = (): void => {}
  const bridge: DesktopHostsBridge = {
    read: vi.fn(async () => selection()), select: vi.fn(async () => {}), openSession: vi.fn(async () => {}),
    subscribe: vi.fn((listener: () => void) => { change = listener; return () => { change = () => {} } }),
    publishSessions: vi.fn(async () => {}), onOpenOwnedSession: vi.fn(() => () => {}),
  }
  return { bridge, change: () => { change() } }
}
const settle = async (): Promise<void> => { for (let index = 0; index < 6; ++index) await Promise.resolve() }

describe('Host navigation', () => {
  it('keeps the newest revision when reads resolve out of order and ignores disposed reads', async () => {
    const { bridge, change } = fixture()
    const reads: Array<(value: HostSelection) => void> = []
    bridge.read = () => new Promise((resolve) => { reads.push(resolve) })
    const model = createHostNavigation(bridge, undefined, vi.fn())
    const stop = model.start()
    change()
    reads[1]!(selection(3)); await settle()
    reads[0]!(selection(2)); await settle()
    expect(model.injected.hooks.hosts.getSnapshot().selection?.revision).toBe(3)
    change(); reads[2]!(selection(1)); await settle()
    expect(model.injected.hooks.hosts.getSnapshot().selection?.revision).toBe(3)
    change(); stop(); reads[3]!(selection(9)); await settle()
    expect(model.injected.hooks.hosts.getSnapshot().selection?.revision).toBe(3)
  })

  it('reports failed navigation without changing the selected Host', async () => {
    const { bridge } = fixture()
    const retry = vi.fn()
    bridge.select = vi.fn().mockRejectedValueOnce(new Error('IPC failed')).mockResolvedValue(undefined)
    const model = createHostNavigation(bridge, undefined, retry)
    const stop = model.start(); await settle()
    model.injected.select('remote'); await settle()
    expect(model.injected.hooks.hosts.getSnapshot()).toMatchObject({ busy: false, error: 'select', selection: { selected: 'local' } })
    model.injected.retry(); await settle()
    expect(bridge.select).toHaveBeenCalledTimes(2)
    expect(bridge.select).toHaveBeenLastCalledWith('remote')
    expect(model.injected.hooks.hosts.getSnapshot().error).toBeUndefined()
    expect(retry).not.toHaveBeenCalled()
    stop()
  })

  it('retains browser Host identity without a Desktop bridge', () => {
    const model = createHostNavigation(undefined, 'https://host.example/', vi.fn())
    const stop = model.start()
    expect(model.injected.hooks.hosts.getSnapshot().address).toBe('https://host.example/')
    stop()
  })

  it('retains a failed publication when another Host causes a successful navigation refresh', async () => {
    const { bridge, change } = fixture()
    const model = createHostNavigation(bridge, undefined, vi.fn())
    const stop = model.start(); await settle()
    model.publicationFailed()
    change(); await settle()
    expect(model.injected.hooks.hosts.getSnapshot().error).toBe('publish')
    model.publicationSucceeded()
    expect(model.injected.hooks.hosts.getSnapshot().error).toBeUndefined()
    stop()
  })

  it('retains the failed navigation target across unrelated Host updates', async () => {
    const { bridge, change } = fixture()
    bridge.openSession = vi.fn().mockRejectedValueOnce(new Error('IPC failed')).mockResolvedValue(undefined)
    const model = createHostNavigation(bridge, undefined, vi.fn())
    const stop = model.start(); await settle()
    model.injected.select('remote', 'session'); await settle()
    change(); await settle()
    expect(model.injected.hooks.hosts.getSnapshot().error).toBe('select')
    model.injected.retry(); await settle()
    expect(bridge.openSession).toHaveBeenLastCalledWith('remote', 'session')
    expect(model.injected.hooks.hosts.getSnapshot().error).toBeUndefined()
    stop()
  })
})

describe('Host publication', () => {
  function sources() {
    const rows: SessionSummary[] = Array.from({ length: 60 }, (_, index) => ({
      id: `session-${index}` as SessionId, title: `Title ${index}`, displayTitle: `Title ${index}`,
      blank: false, running: false, updatedAt: index, retainedBy: {},
    }))
    const sessions = createSnapshotStore<SessionListState>({
      ids: rows.map(row => row.id), byId: Object.fromEntries(rows.map(row => [row.id, row])),
      phase: 'ready', projectionsBySession: {},
    })
    const archived = createSnapshotStore<readonly SessionId[]>([])
    const pending = createSnapshotStore<readonly SessionPendingInteractionBase[]>([])
    return { sessions, archived, pending }
  }

  it('keeps Host metadata unknown until the Session baseline is ready', async () => {
    const { bridge } = fixture()
    const source = sources()
    source.sessions.set({ ...source.sessions.getSnapshot(), phase: 'pending' })
    const publication = publishHostSessions({ bridge, ...source, succeeded: vi.fn(), failed: vi.fn() })
    await settle()
    expect(bridge.publishSessions).not.toHaveBeenCalled()
    source.sessions.set({ ...source.sessions.getSnapshot(), phase: 'ready' })
    await settle()
    expect(bridge.publishSessions).toHaveBeenCalledOnce()
    publication.dispose()
  })

  it('serializes publications, counts requests outside the first 50 sessions and resumes after plugin reload', async () => {
    const { bridge } = fixture()
    bridge.read = async () => ({ ...selection(), publicationRevision: 12 })
    const releases: Array<() => void> = []
    bridge.publishSessions = vi.fn(() => new Promise<void>((resolve) => { releases.push(resolve) }))
    const source = sources()
    const publication = publishHostSessions({ bridge, ...source, succeeded: vi.fn(), failed: vi.fn() })
    await settle()
    source.pending.set([{ key: 'approval:1', kind: 'approval', sessionId: 'session-59' as SessionId },
      { key: 'question:1', kind: 'question', sessionId: 'session-59' as SessionId },
      { key: 'question:2', kind: 'question', sessionId: 'session-59' as SessionId }])
    source.archived.set(['session-0' as SessionId])
    await settle()
    expect(bridge.publishSessions).toHaveBeenCalledTimes(1)
    releases[0]!(); await settle()
    expect(bridge.publishSessions).toHaveBeenLastCalledWith(expect.objectContaining({
      revision: 14, pendingApprovals: 1, pendingQuestions: 2,
    }))
    const last = vi.mocked(bridge.publishSessions).mock.calls[1]![0]
    expect(last.sessions).toHaveLength(50)
    expect(last.sessions[0]?.id).toBe('session-1')
    publication.dispose(); releases[1]!(); await settle()
    source.pending.set([]); await settle()
    expect(bridge.publishSessions).toHaveBeenCalledTimes(2)
  })

  it('makes failed publication retryable and suppresses unchanged successful snapshots', async () => {
    const { bridge } = fixture()
    bridge.publishSessions = vi.fn().mockRejectedValueOnce(new Error('IPC failed')).mockResolvedValue(undefined)
    const failed = vi.fn()
    const succeeded = vi.fn()
    const source = sources()
    const publication = publishHostSessions({ bridge, ...source, failed, succeeded })
    await settle(); expect(failed).toHaveBeenCalledOnce()
    publication.retry(); await settle()
    expect(succeeded).toHaveBeenCalledOnce()
    expect(bridge.publishSessions).toHaveBeenCalledTimes(2)
    source.pending.set([]); await settle()
    expect(bridge.publishSessions).toHaveBeenCalledTimes(2)
    publication.dispose()
  })

  it('republishes the last acknowledged state after an intervening IPC outcome is unknown', async () => {
    const { bridge } = fixture()
    bridge.publishSessions = vi.fn().mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('reply lost')).mockResolvedValue(undefined)
    const source = sources()
    const failed = vi.fn()
    const succeeded = vi.fn()
    const publication = publishHostSessions({ bridge, ...source, failed, succeeded })
    await settle()
    source.pending.set([{ key: 'approval:1', kind: 'approval', sessionId: 'session-1' as SessionId }])
    await settle()
    expect(failed).toHaveBeenCalledOnce()
    source.pending.set([])
    await settle()
    expect(bridge.publishSessions).toHaveBeenCalledTimes(3)
    expect(bridge.publishSessions).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 3, pendingApprovals: 0 }))
    expect(succeeded).toHaveBeenCalledTimes(2)
    publication.dispose()
  })
})
