import { afterEach, expect, it, vi } from 'vitest'
import { desktopClientMetadata, desktopClientRelease, desktopClientVersion } from '../src/client-metadata.ts'

afterEach(() => { vi.unstubAllEnvs() })

it('reports the inlined client build version and the requested language', () => {
  vi.stubEnv('OCEAN_CLIENT_VERSION', '1.2.3')
  expect(desktopClientVersion()).toBe('1.2.3')
  expect(desktopClientMetadata('zh-CN')).toMatchObject({ version: '1.2.3', locale: 'zh-CN',
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 })
})

it('refuses a build that carries no client version instead of guessing one', () => {
  vi.stubEnv('OCEAN_CLIENT_VERSION', undefined)
  expect(() => desktopClientVersion()).toThrow(/OCEAN_CLIENT_VERSION/)
  vi.stubEnv('OCEAN_CLIENT_VERSION', '')
  expect(() => desktopClientMetadata('en')).toThrow(/OCEAN_CLIENT_VERSION/)
})

it('reports the exact source commit only when the build recorded it', () => {
  vi.stubEnv('OCEAN_CLIENT_VERSION', '1.2.3')
  vi.stubEnv('OCEAN_CLIENT_COMMIT_HASH', 'abc')
  expect(desktopClientRelease()).toEqual({ version: '1.2.3', commit: 'abc' })
  vi.stubEnv('OCEAN_CLIENT_COMMIT_HASH', undefined)
  expect(desktopClientRelease()).toEqual({ version: '1.2.3' })
})
