import { describe, expect, it, vi } from 'vitest'
import { RemoteError, type RemoteFailure } from '@ocean/ocean-typert-protocol'
// Type-only: the `remote-access/denied` entry of RemoteErrorDetailsMap, so the
// spec builds the refusal the way the owning package declares it.
import type {} from '@ocean/ocean-api-remote-access/types'
import { accessRefusal, accessRefusalText } from '../src/access-refusal.ts'

function denied(reason: string): RemoteFailure {
  return new RemoteError('remote-access/denied', 'refused', { action: 'terminal/write', reason })
}

describe('accessRefusal', () => {
  it('leaves every failure that is not a Remote access refusal to its caller', () => {
    expect(accessRefusal(new RemoteError('gateway/bad-request', 'refused', {}))).toBeUndefined()
    expect(accessRefusal(new RemoteError('gateway/internal', 'boom', {}))).toBeUndefined()
  })

  it('names the one scope the Gateway reports', () => {
    expect(accessRefusal(denied('scope:terminal:operate'))).toEqual({ key: 'remoteAccess.denied.scope', scope: 'terminal:operate' })
  })

  it('joins several scopes with ", "', () => {
    expect(accessRefusal(denied('scope:files:read|scope:files:write'))).toEqual({ key: 'remoteAccess.denied.scope', scope: 'files:read, files:write' })
  })

  it('explains an action no device scope lists as owner-only', () => {
    expect(accessRefusal(denied('no-allow'))).toEqual({ key: 'remoteAccess.denied.owner' })
  })

  it('leaves every other refusal reason to its caller', () => {
    expect(accessRefusal(denied('resource-invalid'))).toBeUndefined()
    expect(accessRefusal(denied('policy-failed'))).toBeUndefined()
  })
})

describe('accessRefusalText', () => {
  const t = vi.fn((key: string, params?: Record<string, unknown>): string => (params === undefined ? key : `${key} ${String(params.scope)}`))

  it('names the missing scopes through the translator', () => {
    expect(accessRefusalText({ key: 'remoteAccess.denied.scope', scope: 'terminal:operate' }, t)).toBe('remoteAccess.denied.scope terminal:operate')
    expect(t).toHaveBeenLastCalledWith('remoteAccess.denied.scope', { scope: 'terminal:operate' })
  })

  it('passes no parameters for the owner-only explanation', () => {
    t.mockClear()
    expect(accessRefusalText({ key: 'remoteAccess.denied.owner' }, t)).toBe('remoteAccess.denied.owner')
    expect(t).toHaveBeenCalledTimes(1)
    expect(t).toHaveBeenLastCalledWith('remoteAccess.denied.owner')
  })
})
