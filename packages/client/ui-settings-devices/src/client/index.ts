/**
 * The Devices settings page, browser half: the Host device inventory and
 * per-device revocation over the generated `devices` namespace. The section
 * installs only while the calling Peer may read that inventory and only on a
 * Host that has a device registry, so a browser that authenticated as a
 * remote device — which the Gateway never allows to administer devices — and
 * an owner on a Host without device mode are not offered a page that could
 * only fail.
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@ocean/ocean-client-locale/client'
// Type-only: the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@ocean/ocean-client-ui-settings/client'
import type {} from '@ocean/ocean-client-ui-renderer/client'
// Type-only: the ctx.remote Context merge, the generated `devices` namespace,
// and the access answers this page is gated on.
import type {} from '@ocean/ocean-api-remotes/client'
import type {} from '@ocean/ocean-api-remote-access/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { DeviceId } from '@ocean/ocean-api-device-controller/types'
import { DevicesSection, type DevicesSectionInjected } from './DevicesSection.tsx'
import { DevicesController } from './devices-controller.ts'
import { de, en, es, fr, ja, ko, pt, ru, zh, type DevicesLocaleKey } from './locales.ts'

export type { DevicesSectionInjected, DevicesSectionProps } from './DevicesSection.tsx'
export type { DevicesRemote, DevicesState } from './devices-controller.ts'
export type { DevicesLocaleKey } from './locales.ts'

declare module '@ocean/ocean-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Devices settings page copy. */
    'settings.devices': DevicesLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.devices'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'remote', 'remote.devices', 'remoteAccess']

/**
 * Mount the Devices settings page while the calling Peer may read the inventory.
 * The first read decides whether there is a page at all: a Host that runs
 * without a device registry answers `devices/unavailable`, and nothing it
 * could show is worth a section. Any other outcome registers the section, so
 * a failed read can still offer Retry.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt, ko }), 'ui-settings-devices: dictionaries')
  const t = ctx.locale.bind(NS)
  const devices = new DevicesController(ctx.remote.devices)
  // One stable face for the section's lifetime: the renderer binds the inject
  // result by identity, and the section's mount effect keys on `reload`.
  const face = (): DevicesSectionInjected => ({
    hooks: { devices: devices.state },
    reload: () => { void devices.reload() },
    revoke: (id: DeviceId) => { void devices.revoke(id) },
  })
  ctx.remoteAccess.whenAccess('devices/list', () => ctx.effect(() => {
    let stopped = false
    let unregister: (() => void) | undefined
    void devices.reload().then(() => {
      // The read settles after its fiber may be gone; a late answer registers nothing.
      if (stopped) return
      if (devices.state.getSnapshot().unmanaged === true) return
      unregister = ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'devices',
        order: 12,
        label: () => t('title'),
        locale: NS,
        inject: face,
      }, DevicesSection))
    })
    return () => {
      stopped = true
      unregister?.()
    }
  }, 'ui-settings-devices: section'))
}
