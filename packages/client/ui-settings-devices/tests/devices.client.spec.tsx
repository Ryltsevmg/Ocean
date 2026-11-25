// @vitest-environment jsdom
/** The Devices settings section as the settings shell renders it. */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSnapshotSelector } from '@ocean/ocean-client-test-runtime'
import { createSnapshotStore } from '@ocean/ocean-client-store'
import type { DeviceId, DeviceRecord } from '@ocean/ocean-api-device-controller/types'
import { DevicesSection, type DevicesSectionProps } from '../src/client/DevicesSection.tsx'
import type { DevicesState } from '../src/client/devices-controller.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en) => en[key]

const LAPTOP = '11111111-1111-4111-8111-111111111111' as DeviceId
const PHONE = '22222222-2222-4222-8222-222222222222' as DeviceId

const laptop: DeviceRecord = { id: LAPTOP, label: 'Laptop', revoked: false, scopes: ['sessions:read', 'files:read'] }
const phone: DeviceRecord = { id: PHONE, label: 'Phone', revoked: true }

/** Render the section over one published state and return its actions. */
function renderSection(state: Partial<DevicesState> = {}) {
  const store = createSnapshotStore<DevicesState>({ status: 'ready', devices: [laptop, phone], ...state })
  const actions = { reload: vi.fn(), revoke: vi.fn(), close: vi.fn() }
  const props = { ...actions, t, useDevices: bindSnapshotSelector(store) } as DevicesSectionProps
  render(<DevicesSection {...props} />)
  return actions
}

describe('DevicesSection', () => {
  it('reads the inventory once when it mounts', () => {
    const actions = renderSection()

    expect(actions.reload).toHaveBeenCalledOnce()
  })

  it('reports loading before the inventory arrives, and offers Retry after a failed read', () => {
    renderSection({ status: 'loading', devices: [] })
    expect(screen.getByRole('status').textContent).toBe(en.loading)
    cleanup()

    const actions = renderSection({ status: 'failed', devices: [] })
    expect(screen.getByRole('alert').textContent).toContain(en.loadFailed)
    fireEvent.click(screen.getByRole('button', { name: en.retry }))
    expect(actions.reload).toHaveBeenCalledTimes(2)
  })

  it('says the Host manages no devices instead of offering a retry that cannot help', () => {
    renderSection({ status: 'failed', devices: [], unmanaged: true })

    expect(document.body.textContent).toContain(en.unmanaged)
    expect(screen.queryByRole('button', { name: en.retry })).toBeNull()
  })

  it('says so when the Host has no devices', () => {
    renderSection({ devices: [] })

    expect(document.body.textContent).toContain(en.empty)
  })

  it('shows each device with its short id, state, and rights, and offers revocation only for active devices', () => {
    renderSection()

    expect(screen.getByText('Laptop')).toBeDefined()
    expect(screen.getByText('11111111')).toBeDefined()
    expect(screen.getByText(en.active)).toBeDefined()
    expect(screen.getByText('sessions:read')).toBeDefined()
    expect(screen.getByText('files:read')).toBeDefined()
    expect(screen.getByText('Phone')).toBeDefined()
    expect(screen.getByText(en.revoked)).toBeDefined()
    // A device created before scopes holds every right, which the row states instead of leaving blank.
    expect(screen.getByText(en.allRights)).toBeDefined()
    expect(screen.getAllByRole('button', { name: en.revoke })).toHaveLength(1)
  })

  it('asks for confirmation before revoking, and revokes only on the confirming press', () => {
    const actions = renderSection()

    fireEvent.click(screen.getByRole('button', { name: en.revoke }))
    expect(screen.getByRole('button', { name: en.confirm })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: en.cancel }))
    expect(actions.revoke).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: en.confirm })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: en.revoke }))
    fireEvent.click(screen.getByRole('button', { name: en.confirm }))
    expect(actions.revoke).toHaveBeenCalledExactlyOnceWith(LAPTOP)
    expect(screen.queryByRole('button', { name: en.confirm })).toBeNull()
  })

  it('reports progress while the revocation runs and keeps the row on failure', () => {
    renderSection({ revoking: LAPTOP, revokeFailed: LAPTOP })

    expect(screen.getByRole('button', { name: en.revoking })).toHaveProperty('disabled', true)
    expect(screen.getByRole('alert').textContent).toBe(en.revokeFailed)
  })

  it('offers no second action on the row whose revocation is already confirmed and running', () => {
    const actions = renderSection({ revoking: LAPTOP })

    fireEvent.click(screen.getByRole('button', { name: en.revoking }))
    expect(actions.revoke).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: en.confirm })).toBeNull()
  })
})
