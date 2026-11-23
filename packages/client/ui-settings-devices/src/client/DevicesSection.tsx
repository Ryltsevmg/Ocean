/** Devices settings section: the Host's paired devices with per-device revocation. */

import { useEffect, useState } from 'react'
import { Button } from '@ocean/ocean-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@ocean/ocean-client-ui-slots'
import type { DeviceId, DeviceRecord, DeviceScope } from '@ocean/ocean-api-device-controller/types'
import type { DevicesState } from './devices-controller.ts'
import type { DevicesLocaleKey } from './locales.ts'
import css from './DevicesSection.module.css'

/** Registration-side business face for the section. */
export interface DevicesSectionInjected {
  hooks: {
    /** Load and revocation state owned by the plugin. */
    devices: HostObservable<DevicesState>
  }
  /** Read the inventory again, replacing whatever the previous read left. */
  reload: () => void
  /** @param id - device the owner confirmed for revocation. */
  revoke: (id: DeviceId) => void
}

/** Composed props for the Devices settings section. */
export type DevicesSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.devices'>
  & InjectFace<DevicesSectionInjected>

/**
 * The shortest identifier that still names one device: its leading UUID
 * segment, with the full value carried as the element's tooltip.
 * @param id - device identifier as the registry minted it.
 * @returns the first eight characters.
 */
function shortId(id: DeviceId): string {
  return id.slice(0, 8)
}

/**
 * @param t - section copy.
 * @param scopes - rights the device holds, absent for a device that holds every right.
 * @returns one chip label per right.
 */
function rights(t: (key: DevicesLocaleKey) => string, scopes: readonly DeviceScope[] | undefined): readonly string[] {
  return scopes === undefined ? [t('allRights')] : [...scopes]
}

/** One inventory row: identity, state, rights, and the revoke control while the device is active. */
function DeviceRow({ device, t, armed, revoking, failed, onArm, onCancel, onRevoke }: {
  device: DeviceRecord
  t: (key: DevicesLocaleKey) => string
  armed: boolean
  revoking: boolean
  failed: boolean
  onArm: () => void
  onCancel: () => void
  onRevoke: () => void
}) {
  return (
    <li className={css.row}>
      <div className={css.copy}>
        <span className={css.label}>{device.label}</span>
        <span className={css.meta}>
          <span className={css.id} title={device.id}>{shortId(device.id)}</span>
          <span className={device.revoked ? css.revoked : css.active}>
            {device.revoked ? t('revoked') : t('active')}
          </span>
        </span>
        <span className={css.rights}>
          <span className={css.rightsLabel}>{t('rights')}</span>
          {rights(t, device.scopes).map(right => <span key={right} className={css.right}>{right}</span>)}
        </span>
      </div>
      <div className={css.actions}>
        {device.revoked ? null : armed ? (
          <>
            <Button variant="ghost" disabled={revoking} onClick={onCancel}>{t('cancel')}</Button>
            <Button variant="primary" disabled={revoking} onClick={onRevoke}>{t('confirm')}</Button>
          </>
        ) : (
          <Button variant="outline" disabled={revoking} onClick={onArm}>
            {revoking ? t('revoking') : t('revoke')}
          </Button>
        )}
      </div>
      {failed && <p className={css.rowError} role="alert">{t('revokeFailed')}</p>}
    </li>
  )
}

/**
 * @param props - localized copy, the inventory subscription, and the two actions.
 * @returns the Devices settings page.
 */
export function DevicesSection({ t, useDevices, reload, revoke }: DevicesSectionProps) {
  const state = useDevices(value => value)
  // The confirmation belongs to the row the owner pressed, so it never outlives that row.
  const [armed, setArmed] = useState<DeviceId>()
  // `reload` is created once per plugin, so this reads the inventory on each
  // mount without re-reading on every render.
  useEffect(() => { reload() }, [reload])
  return (
    <div className={css.section}>
      <h2 className={css.heading}>{t('title')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {state.status === 'loading' && <p className={css.status} role="status">{t('loading')}</p>}
      {state.status === 'failed' && (
        <div className={css.failure} role="alert">
          <p className={css.failureText}>{t('loadFailed')}</p>
          <Button variant="outline" onClick={reload}>{t('retry')}</Button>
        </div>
      )}
      {state.status === 'ready' && state.devices.length === 0 && <p className={css.status}>{t('empty')}</p>}
      {state.status === 'ready' && state.devices.length > 0 && (
        <ul className={css.list}>
          {state.devices.map(device => (
            <DeviceRow
              key={device.id}
              device={device}
              t={t}
              armed={armed === device.id}
              revoking={state.revoking === device.id}
              failed={state.revokeFailed === device.id}
              onArm={() => { setArmed(device.id) }}
              onCancel={() => { setArmed(undefined) }}
              onRevoke={() => {
                setArmed(undefined)
                revoke(device.id)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
