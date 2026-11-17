/** Renderer metadata remains bounded and contains no credential fields. */
import { expect, it } from 'vitest'
import { readDesktopHostPublication } from '../src/remote-publication.ts'
import { resolveDesktopRemoteConfig } from '../src/remote-configuration.ts'

const publication = { revision: 0, sessions: [{ id: 'session', title: 'Project' }], pendingApprovals: 2, pendingQuestions: 1 }

it('accepts independent pending totals beyond the recent-session list', () => {
  expect(readDesktopHostPublication(publication)).toEqual(publication)
  expect(readDesktopHostPublication({ ...publication, sessions: [] })).toMatchObject({ pendingApprovals: 2 })
})

it.each([
  null, [], {}, { ...publication, revision: -1 }, { ...publication, revision: 0.5 },
  { ...publication, revision: Number.MAX_SAFE_INTEGER + 1 },
  { ...publication, pendingApprovals: -1 }, { ...publication, pendingQuestions: 0.5 },
  { ...publication, pendingQuestions: Infinity }, { ...publication, token: 'fixture-secret' },
  { ...publication, sessions: Array.from({ length: 51 }, (_, id) => ({ id: String(id), title: '' })) },
  { ...publication, sessions: [{ id: '', title: '' }] },
  { ...publication, sessions: [{ id: 'x'.repeat(129), title: '' }] },
  { ...publication, sessions: [{ id: 'session', title: 'x'.repeat(257) }] },
  { ...publication, sessions: [{ id: 'session', title: '', token: 'fixture-secret' }] },
  { ...publication, sessions: [...publication.sessions, ...publication.sessions] },
])('rejects malformed or excessive Host metadata: %j', (value) => {
  expect(readDesktopHostPublication(value)).toBeUndefined()
})

it('resolves the connection limit without evicting existing Hosts', () => {
  expect(resolveDesktopRemoteConfig({})).toEqual({ maxConnections: 4 })
  expect(resolveDesktopRemoteConfig({ OCEAN_DESKTOP_MAX_REMOTE_HOSTS: '1' })).toEqual({ maxConnections: 1 })
  expect(resolveDesktopRemoteConfig({ OCEAN_DESKTOP_MAX_REMOTE_HOSTS: '8' })).toEqual({ maxConnections: 8 })
})

it.each(['', '0', '-1', '2.5', ' 4', '4x', 'Infinity', '9007199254740992'])('rejects an invalid connection limit: %s', (value) => {
  expect(() => resolveDesktopRemoteConfig({ OCEAN_DESKTOP_MAX_REMOTE_HOSTS: value }))
    .toThrow(expect.objectContaining({ code: 'DESKTOP_REMOTE_CONFIG_INVALID' }))
})
