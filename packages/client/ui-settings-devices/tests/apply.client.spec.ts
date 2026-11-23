/** What the browser half registers, when, and that it all leaves with the fiber. */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { resolveSlotLabel } from '@ocean/ocean-client-ui-slots'
import { SlotRegistry } from '@ocean/ocean-client-ui-renderer/client'
import { RemoteError, TestRemote } from '@ocean/ocean-client-test-runtime'
import { LocaleRuntime } from '@ocean/ocean-client-locale/client'
import type { DeviceId } from '@ocean/ocean-api-device-controller/types'
import { apply, inject, NS } from '../src/client/index.ts'
import type { DevicesSectionInjected, DevicesRemote, DevicesState } from '../src/client/index.ts'
import { apply as hostApply } from '../src/index.ts'

const LAPTOP = '11111111-1111-4111-8111-111111111111' as DeviceId

/**
 * Mount the browser half over a scripted Remote and an access answer the test
 * controls.
 * @param allowed - whether the calling Peer may read the inventory.
 */
async function bench(allowed = true): Promise<{
  ctx: Context
  list: Mock<DevicesRemote['list']>
  revoke: Mock<DevicesRemote['revoke']>
  whenAccess: Mock<(action: string, callback: () => () => void) => () => void>
}> {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  locale.setLocale('zh')
  ctx.provide('locale', locale)
  const list = vi.fn<DevicesRemote['list']>(() => Promise.resolve({
    ok: true, value: [{ id: LAPTOP, label: 'Laptop', revoked: false }],
  }))
  const revoke = vi.fn<DevicesRemote['revoke']>(() => Promise.resolve({ ok: true, value: { id: LAPTOP, revoked: true } }))
  new TestRemote(ctx, { devices: { list, revoke } })
  const whenAccess = vi.fn((_action: string, callback: () => () => void) => allowed ? callback() : () => {})
  ctx.provide('remoteAccess', { whenAccess } as never)
  return { ctx, list, revoke, whenAccess }
}

/**
 * The registration's inject face, read through its erased type.
 * @param entry - one registered section.
 * @returns the face the plugin registered for it.
 */
function faceOf(entry: {
  readonly inject?: ((...args: never[]) => Record<string, unknown>) | undefined
}): DevicesSectionInjected {
  const inject = entry.inject
  if (inject === undefined) throw new Error('section registered without an inject face')
  return inject() as Pick<DevicesSectionInjected, 'hooks' | 'reload' | 'revoke'>
}

/** The settings shell's section slot, as its owner declares it. */
function declareShell(slots: SlotRegistry): () => void {
  return slots.register({
    name: 'root',
    children: { 'settings.section': { kind: 'list', scope: 'root' } },
  } as never, () => null)
}

describe('ui-settings-devices apply', () => {
  it('keeps the host Loader entry inert', () => {
    expect(hostApply).not.toThrow()
  })

  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'remote', 'remote.devices', 'remoteAccess'])
  })

  it('registers the section while the Peer may read the inventory, titled in the active locale', async () => {
    const { ctx, whenAccess } = await bench()
    const slots = ctx.get('slots') as SlotRegistry
    declareShell(slots)

    await ctx.plugin({ inject: [...inject], apply }).await()

    await vi.waitFor(() => { expect(slots.entries('settings.section')).toHaveLength(1) })
    const entry = slots.entries('settings.section')[0]!
    expect(entry.options).toMatchObject({ id: 'devices', order: 5 })
    expect(resolveSlotLabel(entry.options.label)).toBe('设备')
    expect(entry.locale).toBe(NS)
    expect(whenAccess).toHaveBeenCalledWith('devices/list', expect.any(Function))
    const face = faceOf(entry)
    expect(Object.keys(face.hooks)).toEqual(['devices'])
  })

  it('drives the namespace through the injected actions', async () => {
    const { ctx, list, revoke } = await bench()
    const slots = ctx.get('slots') as SlotRegistry
    declareShell(slots)
    await ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => { expect(slots.entries('settings.section')).toHaveLength(1) })
    const face = faceOf(slots.entries('settings.section')[0]!)

    face.reload()
    face.revoke(LAPTOP)

    await vi.waitFor(() => { expect(revoke).toHaveBeenCalledExactlyOnceWith({ id: LAPTOP }) })
    expect(list).toHaveBeenCalledOnce()
    const state: DevicesState = face.hooks.devices.getSnapshot()
    expect(state.devices).toEqual([{ id: LAPTOP, label: 'Laptop', revoked: true }])
  })

  it('keeps the section installed while a revocation is refused, so the row can report it', async () => {
    const { ctx, revoke } = await bench()
    const slots = ctx.get('slots') as SlotRegistry
    declareShell(slots)
    revoke.mockResolvedValue({ ok: false, error: new RemoteError('devices/not-found', 'gone', { id: LAPTOP }) })
    await ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => { expect(slots.entries('settings.section')).toHaveLength(1) })
    const face = faceOf(slots.entries('settings.section')[0]!)
    face.reload()
    await vi.waitFor(() => { expect(face.hooks.devices.getSnapshot().devices).toHaveLength(1) })

    face.revoke(LAPTOP)

    await vi.waitFor(() => { expect(face.hooks.devices.getSnapshot().revokeFailed).toBe(LAPTOP) })
    expect(face.hooks.devices.getSnapshot().devices).toEqual([{ id: LAPTOP, label: 'Laptop', revoked: false }])
  })

  it('registers nothing while the Peer may not read the inventory', async () => {
    const { ctx } = await bench(false)
    const slots = ctx.get('slots') as SlotRegistry
    declareShell(slots)

    await ctx.plugin({ inject: [...inject], apply }).await()

    expect(slots.entries('settings.section')).toHaveLength(0)
  })

  it('collapses the section on teardown', async () => {
    const { ctx } = await bench()
    const slots = ctx.get('slots') as SlotRegistry
    declareShell(slots)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => { expect(slots.entries('settings.section')).toHaveLength(1) })

    await fiber.dispose()

    expect(slots.entries('settings.section')).toHaveLength(0)
  })
})
