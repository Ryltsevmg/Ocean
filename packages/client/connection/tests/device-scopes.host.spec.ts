/** Scope names are validated and normalized before any device record stores them. */
import { expect, it } from 'vitest'
import { DEVICE_SCOPES, parseDeviceScopes } from '../src/device-scopes.ts'

it('returns the named scopes once each, in catalog order', () => {
  expect(parseDeviceScopes(['terminal:operate', 'sessions:read', 'sessions:read'])).toEqual(['sessions:read', 'terminal:operate'])
  expect(parseDeviceScopes([...DEVICE_SCOPES].reverse())).toEqual([...DEVICE_SCOPES])
})

it('refuses an unknown scope by name and lists the valid ones', () => {
  expect(() => parseDeviceScopes(['sessions:read', 'admin'])).toThrow('unknown device scope "admin"; use sessions:read')
})

it('refuses an empty selection', () => {
  expect(() => parseDeviceScopes([])).toThrow('name at least one device scope')
})
