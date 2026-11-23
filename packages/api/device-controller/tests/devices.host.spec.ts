/**
 * The `devices` namespace as an owner sees it: the registry inventory, the
 * revocation that closes live transports, and the owner-only default the
 * Gateway's `remote-device` policy leaves in place.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import RemoteAccessService from '@ocean/ocean-api-remote-access'
import TypertGatewayService from '@ocean/ocean-api-gateway'
import TypertRegistry from '@ocean/ocean-typert-registry'
import { Peer, type DeviceId, type DeviceMetadata, type DeviceScope } from '@ocean/ocean-client-connection'
import { DEVICE_SCOPES } from '@ocean/ocean-client-connection/device'
import type { PeerScope, Principal, PrincipalMap } from '@ocean/ocean-typert-protocol'
import DeviceController from '../src/index.ts'

const roots: Context[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(ctx => ctx.fiber.dispose()))
})

/** One registry row, with the scopes the caller names. */
function device(id: string, label: string, revoked = false, scopes?: readonly DeviceScope[]): DeviceMetadata {
  return { id: id as DeviceId, label, revoked, ...scopes === undefined ? {} : { scopes } }
}

/** A Connection double exposing only the device registry the namespace reads. */
function provideConnection(
  ctx: Context,
  registry: readonly DeviceMetadata[],
  live: Readonly<Record<string, readonly DeviceScope[]>> = {},
): { readonly listDevices: ReturnType<typeof vi.fn>; readonly revokeDevice: ReturnType<typeof vi.fn> } {
  const listDevices = vi.fn(() => Promise.resolve(registry))
  const revokeDevice = vi.fn(() => Promise.resolve(true))
  ctx.provide('connection', {
    rpc: { intercept: () => () => Promise.resolve() },
    listDevices,
    revokeDevice,
    deviceScopes: (deviceId: string) => live[deviceId],
  } as never)
  return { listDevices, revokeDevice }
}

/** Mount the Remote stack, then the controller on top of the given Connection. */
async function mounted(registry: readonly DeviceMetadata[] = [], live: Readonly<Record<string, readonly DeviceScope[]>> = {}) {
  const ctx = new Context()
  roots.push(ctx)
  await ctx.plugin(TypertRegistry)
  await ctx.plugin(RemoteAccessService)
  await ctx.plugin(TypertGatewayService)
  const connection = provideConnection(ctx, registry, live)
  await ctx.plugin(DeviceController)
  return { ctx, connection }
}

/** An in-process Peer of one principal, disposed with the test tree. */
function peerFor(ctx: Context, principal: Principal): PeerScope {
  return new Peer(ctx.root, { principal })
}

/** Invoke one `devices` method as one Peer. */
function call(ctx: Context, peer: PeerScope, method: 'list' | 'revoke', args: Record<string, unknown> = {}): Promise<unknown> {
  return ctx.typertGateway.invoke({ peer, namespace: 'devices', method, args })
}

const LAPTOP = '11111111-1111-4111-8111-111111111111'
const PHONE = '22222222-2222-4222-8222-222222222222'

describe('devices namespace', () => {
  it('lists every registry device to its owner, with scopes only where the registry stores them', async () => {
    const { ctx } = await mounted([
      device(LAPTOP, 'Laptop', false, ['sessions:read']),
      device(PHONE, 'Phone', true),
    ])

    const value = await call(ctx, peerFor(ctx, { kind: 'owner' }), 'list')

    expect(value).toEqual([
      { id: LAPTOP, label: 'Laptop', revoked: false, scopes: ['sessions:read'] },
      { id: PHONE, label: 'Phone', revoked: true },
    ])
    // A device created before scopes carries no `scopes` key at all, rather than an empty list.
    expect(Object.hasOwn((value as readonly object[])[1]!, 'scopes')).toBe(false)
  })

  it('revokes through Connection so the device loses its live transports too', async () => {
    const { ctx, connection } = await mounted([device(LAPTOP, 'Laptop')])
    const owner = peerFor(ctx, { kind: 'owner' })

    await expect(call(ctx, owner, 'revoke', { request: { id: LAPTOP } }))
      .resolves.toEqual({ id: LAPTOP, revoked: true })
    expect(connection.revokeDevice).toHaveBeenCalledExactlyOnceWith(LAPTOP)
  })

  it('reports an id the registry does not hold instead of reading it as already revoked', async () => {
    const { ctx, connection } = await mounted([device(LAPTOP, 'Laptop')])

    await expect(call(ctx, peerFor(ctx, { kind: 'owner' }), 'revoke', { request: { id: PHONE } }))
      .rejects.toMatchObject({ code: 'devices/not-found', details: { id: PHONE } })
    expect(connection.revokeDevice).not.toHaveBeenCalled()
  })

  it('denies both methods to a non-owner device whatever scopes it holds', async () => {
    const { ctx, connection } = await mounted(
      [device(LAPTOP, 'Laptop')],
      { [PHONE]: DEVICE_SCOPES },
    )
    const devicePrincipal: PrincipalMap['remote-device'] = {
      kind: 'remote-device', deviceId: PHONE as PrincipalMap['remote-device']['deviceId'],
    }
    const peer = peerFor(ctx, devicePrincipal)

    await expect(call(ctx, peer, 'list')).rejects.toMatchObject({
      code: 'remote-access/denied', details: { action: 'devices/list', reason: 'no-allow' },
    })
    await expect(call(ctx, peer, 'revoke', { request: { id: LAPTOP } })).rejects.toMatchObject({
      code: 'remote-access/denied', details: { action: 'devices/revoke', reason: 'no-allow' },
    })
    expect(connection.listDevices).not.toHaveBeenCalled()
    expect(connection.revokeDevice).not.toHaveBeenCalled()
  })

  it('reports a Host that runs without a device registry as unavailable, not as an empty one', async () => {
    const { ctx, connection } = await mounted([device(LAPTOP, 'Laptop')])
    connection.listDevices.mockRejectedValueOnce(new Error('client-connection: device login is unavailable'))
    const owner = peerFor(ctx, { kind: 'owner' })

    await expect(call(ctx, owner, 'list')).rejects.toMatchObject({
      code: 'devices/unavailable',
      message: 'client-connection: device login is unavailable',
    })
    // A registry failure that is not an Error still reports its text.
    connection.listDevices.mockRejectedValueOnce('registry offline')
    await expect(call(ctx, owner, 'revoke', { request: { id: LAPTOP } }))
      .rejects.toMatchObject({ code: 'devices/unavailable', message: 'registry offline' })
    expect(connection.revokeDevice).not.toHaveBeenCalled()
  })

  it('stays unactivated while the composition mounts no Connection', async () => {
    const ctx = new Context()
    roots.push(ctx)
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(TypertGatewayService)

    await ctx.plugin(DeviceController)

    expect(ctx.get('deviceController')).toBeUndefined()
  })
})
