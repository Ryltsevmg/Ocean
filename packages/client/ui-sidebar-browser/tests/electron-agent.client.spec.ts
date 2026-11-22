// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { electronFixture } from './electron-harness.client.ts'

const target = { kind: 'https' as const, url: 'https://example.test/', title: 'Example' }
const fixtures: ReturnType<typeof electronFixture>[] = []
function fixture(sessionId?: string) {
  const h = electronFixture(undefined, sessionId)
  fixtures.push(h)
  return h
}

afterEach(async () => {
  for (const h of fixtures.splice(0)) await h.dispose()
  vi.restoreAllMocks()
})

describe('Electron Agent sharing', () => {
  it('is absent when the tab has no Session binding', () => {
    const h = fixture()
    expect(h.frame.agent).toBeUndefined()
    expect(h.frame.getSnapshot().agentEnabled).toBeUndefined()
  })

  it('binds after the guest exists and revokes on request', async () => {
    const h = fixture('session-1')
    expect(h.frame.agent).toBeDefined()
    h.frame.agent?.setEnabled(true)
    // The wish is remembered without latching a busy flag the UI would never clear.
    expect(h.frame.getSnapshot()).toMatchObject({ agentEnabled: false, agentBusy: false })
    h.frame.loadUrl(target)
    h.mount()
    const guest = await h.guest()
    guest.emit('dom-ready')
    await vi.waitFor(() => {
      expect(h.bridge.bindAgent).toHaveBeenCalledWith(h.reservation.lease, 'session-1')
      expect(h.frame.getSnapshot()).toMatchObject({ agentEnabled: true, agentBusy: false, agentFailure: undefined })
    })
    h.frame.agent?.setEnabled(false)
    expect(h.frame.getSnapshot()).toMatchObject({ agentEnabled: false, agentBusy: true })
    await vi.waitFor(() => {
      expect(h.bridge.unbindAgent).toHaveBeenCalledWith(h.reservation.lease)
      expect(h.frame.getSnapshot()).toMatchObject({ agentEnabled: false, agentBusy: false })
    })
  })

  it('keeps the toggle usable when the guest cannot mount yet', () => {
    const h = fixture('session-1')
    h.frame.agent?.setEnabled(true)
    h.frame.agent?.setEnabled(true)
    h.frame.agent?.setEnabled(false)
    expect(h.frame.getSnapshot()).toMatchObject({ agentEnabled: false, agentBusy: false, agentFailure: undefined })
    expect(h.bridge.bindAgent).not.toHaveBeenCalled()
  })

  it('reports a bind failure and leaves the tab private', async () => {
    const h = fixture('session-1')
    h.bridge.bindAgent.mockRejectedValueOnce(new Error('refused'))
    h.frame.loadUrl(target)
    h.mount()
    const guest = await h.guest()
    guest.emit('dom-ready')
    h.frame.agent?.setEnabled(true)
    await vi.waitFor(() => {
      expect(h.frame.getSnapshot()).toMatchObject({ agentEnabled: false, agentBusy: false, agentFailure: 'bind' })
    })
  })
})
