import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlanVault } from '../src/chatgpt-plan-vault.js'

test('a separate plan vault preserves existing credentials and isolates registrations', async () => {
  const records = new Map([['legacy', { kind: 'grant', payload: { marker: 'unchanged' } }]])
  const credentials = {
    readRecord: async key => structuredClone(records.get(key)),
    modifyRecord: async (key, update) => { const value = await update(structuredClone(records.get(key))); if (value !== undefined) records.set(key, structuredClone(value)); return structuredClone(records.get(key)) },
  }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  assert.equal(await vault.hostId(), hostId)
  const grant = { clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'private-access', refreshToken: 'private-refresh', idToken: 'private-id', expiresAt: Date.now() + 1000, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'Work')
  assert.deepEqual(records.get('legacy'), { kind: 'grant', payload: { marker: 'unchanged' } })
  const status = await vault.status()
  assert.equal(status.accounts.length, 1)
  assert.equal(status.accounts[0].label, 'Work')
  assert.doesNotMatch(JSON.stringify(status), /private|subject-a|oaiapp_a/)
  await assert.rejects(vault.add({ ...grant, subject: 'other-subject' }, 'Other'))
  assert.equal((await vault.readActive()).subject, 'subject-a')
  const refreshed = await vault.fresh({ now: Date.now() + 2000, refresh: async previous => ({ ...previous, accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: Date.now() + 60000 }) })
  assert.equal(refreshed.accessToken, 'new-access')
  assert.equal((await vault.readActive()).refreshToken, 'new-refresh')
  assert.deepEqual(records.get('legacy'), { kind: 'grant', payload: { marker: 'unchanged' } })
})

test('concurrent refreshes use one serialized rotation', async () => {
  let stored, tail = Promise.resolve(), calls = 0
  const credentials = {
    readRecord: async () => structuredClone(stored),
    modifyRecord: (_key, update) => {
      const operation = tail.then(async () => { const next = await update(structuredClone(stored)); if (next !== undefined) stored = structuredClone(next); return structuredClone(stored) })
      tail = operation.catch(() => {})
      return operation
    },
  }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  await vault.add({ clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'old-access', refreshToken: 'old-refresh', idToken: 'id', expiresAt: 1, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }, 'Work')
  const refresh = async old => { calls++; return { ...old, accessToken: 'new-access', refreshToken: 'new-refresh', expiresAt: 100 } }
  const [first, second] = await Promise.all([vault.fresh({ now: 2, refresh }), vault.fresh({ now: 2, refresh })])
  assert.equal(calls, 1)
  assert.equal(first.refreshToken, 'new-refresh')
  assert.equal(second.refreshToken, 'new-refresh')
  await assert.rejects(vault.fresh({ now: 101, refresh: async () => { throw new Error('refresh failed') } }))
  assert.equal((await vault.readActive()).refreshToken, 'new-refresh')
  let retried = false
  await assert.rejects(vault.fresh({ now: 101, refresh: async () => { retried = true; return first } }))
  assert.equal(retried, false)
  assert.equal((await vault.status()).accounts[0].reauthorizationRequired, true)
  await vault.add({ ...first, expiresAt: 500 }, 'Work')
  assert.equal((await vault.status()).accounts[0].reauthorizationRequired, false)
})

test('rejects a stored vault that associates one client ID with multiple accounts', async () => {
  const hostId = 'urn:uuid:00000000-0000-4000-8000-000000000000'
  const grant = { clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'private', refreshToken: 'private', idToken: 'private', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  const credentials = { readRecord: async () => ({ kind: 'grant', payload: { version: 1, hostId, activeId: 'one', accounts: [{ id: 'one', label: 'A', grant }, { id: 'two', label: 'B', grant: { ...grant, subject: 'subject-b' } }] } }) }
  const vault = createPlanVault({ credentials, key: 'plan' })
  await assert.rejects(vault.status())
})

test('switching registrations changes only the active plan account', async () => {
  let record
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { const next = await update(structuredClone(record)); if (next !== undefined) record = structuredClone(next); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  const grant = { clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'private-a', refreshToken: 'private-r', idToken: 'private-i', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'First')
  await vault.add({ ...grant, clientId: 'oaiapp_b', subject: 'subject-b', accessToken: 'private-b' }, 'Second')
  const status = await vault.status()
  await assert.rejects(vault.select('unknown'))
  await vault.select(status.accounts[0].id)
  assert.equal((await vault.readActive()).clientId, 'oaiapp_a')
  assert.equal((await vault.status()).accounts.length, 2)
  assert.deepEqual(await vault.registration(status.accounts[0].id), { clientId: 'oaiapp_a', subject: 'subject-a' })
  await assert.rejects(vault.registration('unknown'))
})

test('failed persistence after rotation leaves a durable marker and never reuses the old token', async () => {
  let record, failCommit = false, calls = 0
  const credentials = {
    readRecord: async () => structuredClone(record),
    modifyRecord: async (_key, update) => {
      const next = await update(structuredClone(record))
      if (failCommit && next?.payload?.accounts?.[0]?.refreshPending === false) throw new Error('write failed')
      if (next !== undefined) record = structuredClone(next)
      return structuredClone(record)
    },
  }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  await vault.add({ clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'a', refreshToken: 'old', idToken: 'i', expiresAt: 1, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }, 'Work')
  failCommit = true
  const refresh = async old => { calls++; return { ...old, refreshToken: 'new', expiresAt: 100 } }
  await assert.rejects(vault.fresh({ now: 2, refresh }))
  const reopened = createPlanVault({ credentials, key: 'plan' })
  await assert.rejects(reopened.fresh({ now: 2, refresh }))
  assert.equal(calls, 1)
  assert.equal((await reopened.status()).accounts[0].reauthorizationRequired, true)
})

test('sign out clears only selected tokens and retires the registration on remote failure', async () => {
  let record
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { const next = await update(structuredClone(record)); if (next !== undefined) record = structuredClone(next); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  const first = { clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'access-a', refreshToken: 'refresh-a', idToken: 'id-a', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(first, 'First')
  const firstId = (await vault.status()).activeId
  await vault.add({ ...first, clientId: 'oaiapp_b', subject: 'subject-b', accessToken: 'access-b', refreshToken: 'refresh-b', idToken: 'id-b' }, 'Second')
  await vault.select(firstId)
  let attempts = 0
  const result = await vault.signOut({ id: firstId, revoke: async grant => { attempts++; assert.equal(grant.refreshToken, 'refresh-a'); throw new Error('offline') } })
  assert.equal(result.remoteRevoked, false)
  assert.equal(attempts, 1)
  assert.equal((await createPlanVault({ credentials, key: 'plan' }).status()).accounts.find(x => x.id === firstId).revocationUnconfirmed, true)
  await assert.rejects(vault.registration(firstId))
  assert.equal((await vault.status()).accounts.find(x => x.id === firstId).signedOut, true)
  assert.doesNotMatch(JSON.stringify(record), /access-a|refresh-a|id-a/)
  assert.match(JSON.stringify(record), /refresh-b/)
  await assert.rejects(vault.fresh({ now: 1, refresh: async () => assert.fail() }))
  await assert.rejects(vault.add({ ...first, accessToken: 'new-access' }, 'First'))
  assert.equal((await vault.status()).accounts.find(x => x.id === firstId).retired, true)
})

test('sign out after an uncertain refresh clears tokens without reusing or revoking the old token', async () => {
  let record
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { record = structuredClone(await update(structuredClone(record))); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  await vault.add({ clientId: 'oaiapp_a', subject: 'subject-a', hostId, accessToken: 'access-private', refreshToken: 'refresh-private', idToken: 'id-private', expiresAt: 1, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }, 'First')
  await assert.rejects(vault.fresh({ now: 2, refresh: async () => { throw new Error('outcome unknown') } }))
  const activeId = (await vault.status()).activeId
  assert.deepEqual(await vault.signOut({ id: activeId, revoke: async () => assert.fail('unknown token must not be revoked') }), { remoteRevoked: false })
  assert.doesNotMatch(JSON.stringify(record), /access-private|refresh-private|id-private/)
  assert.equal((await vault.status()).accounts[0].signedOut, true)
})

test('sign out cannot revoke a different active account', async () => {
  let record
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { record = structuredClone(await update(structuredClone(record))); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  const grant = { clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'a', idToken: 'a', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'First')
  const firstId = (await vault.status()).activeId
  await vault.add({ ...grant, clientId: 'b', subject: 'b' }, 'Second')
  await assert.rejects(vault.signOut({ id: firstId, revoke: async () => assert.fail('wrong account') }))
  assert.equal((await vault.status()).accounts.every(account => !account.signedOut), true)
})

test('credential access is bound to the expected account even across vault instances', async () => {
  let record
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { record = structuredClone(await update(structuredClone(record))); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  const grant = { clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'a', idToken: 'a', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'First')
  const firstId = (await vault.status()).activeId
  await vault.add({ ...grant, clientId: 'b', subject: 'b' }, 'Second')
  const otherHost = createPlanVault({ credentials, key: 'plan' })
  await assert.rejects(otherHost.fresh({ expectedId: firstId, now: 2, refresh: async () => assert.fail() }))
})

test('a rotation is saved but never returned when another host changes the active account', async () => {
  let record, finish
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { record = structuredClone(await update(structuredClone(record))); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  const grant = { clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'old', idToken: 'a', expiresAt: 1, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'First')
  const firstId = (await vault.status()).activeId
  const refreshing = vault.fresh({ expectedId: firstId, now: 2, refresh: async old => new Promise(resolve => { finish = () => resolve({ ...old, refreshToken: 'new', expiresAt: 100 }) }), onDiscard: async () => assert.fail('a saved rotation must not be revoked') })
  await new Promise(resolve => setImmediate(resolve))
  await vault.add({ ...grant, clientId: 'b', subject: 'b' }, 'Second')
  finish()
  await assert.rejects(refreshing)
  await vault.select(firstId)
  assert.equal((await vault.readActive()).refreshToken, 'new')
})

test('a committed rotation is not revoked when the storage lock release fails afterwards', async () => {
  let record, failAfterCommit = false, revoked = false
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { const next = await update(structuredClone(record)); if (next !== undefined) record = structuredClone(next); if (next !== undefined && failAfterCommit && record.payload.accounts[0].grant.refreshToken === 'new') throw new Error('unlock failed'); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  await vault.add({ clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'old', idToken: 'a', expiresAt: 1, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }, 'First')
  failAfterCommit = true
  await assert.rejects(vault.fresh({ now: 2, refresh: async previous => ({ ...previous, refreshToken: 'new', expiresAt: 100 }), onDiscard: async () => { revoked = true } }))
  assert.equal(revoked, false)
  assert.equal((await vault.readActive()).refreshToken, 'new')
})

test('a newer token for the same registration is never revoked during uncertain-write recovery', async () => {
  let record, replaceDuringWrite = false, revoked = false, unknown = false
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => {
    const next = await update(structuredClone(record))
    if (next !== undefined) record = structuredClone(next)
    if (replaceDuringWrite && next?.payload?.accounts?.[0]?.grant?.refreshToken === 'new') {
      record.payload.accounts[0].grant.refreshToken = 'newer'
      throw new Error('write outcome unknown')
    }
    return structuredClone(record)
  } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  await vault.add({ clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'old', idToken: 'a', expiresAt: 1, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }, 'First')
  replaceDuringWrite = true
  await assert.rejects(vault.fresh({ now: 2, refresh: async previous => ({ ...previous, refreshToken: 'new', expiresAt: 100 }), onDiscard: async () => { revoked = true }, onUnknown: () => { unknown = true } }))
  assert.equal(revoked, false)
  assert.equal(unknown, true)
  assert.equal((await vault.readActive()).refreshToken, 'newer')
})

test('a second host cannot clear pending revocation or reauthorize while revoke is running', async () => {
  let record, finish
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { const next = await update(structuredClone(record)); if (next !== undefined) record = structuredClone(next); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const other = createPlanVault({ credentials, key: 'plan' })
  const hostId = await vault.hostId()
  const grant = { clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'old', idToken: 'a', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'First')
  const id = (await vault.status()).activeId
  const signingOut = vault.signOut({ id, revoke: async () => new Promise(resolve => { finish = resolve }) })
  await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(other.signOut({ id, revoke: async () => assert.fail() }))
  await assert.rejects(other.add({ ...grant, refreshToken: 'replacement' }, 'First'))
  assert.equal(record.payload.accounts[0].revocationPending, true)
  finish()
  assert.deepEqual(await signingOut, { remoteRevoked: true })
})

test('interrupted revocation recovery retires only the selected registration and isolates a late revoke', async () => {
  let record, finish
  const credentials = { readRecord: async () => structuredClone(record), modifyRecord: async (_key, update) => { const next = await update(structuredClone(record)); if (next !== undefined) record = structuredClone(next); return structuredClone(record) } }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  const grant = { clientId: 'old-client', subject: 'a', hostId, accessToken: 'old-access', refreshToken: 'old-refresh', idToken: 'old-id', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await vault.add(grant, 'First')
  const id = (await vault.status()).activeId
  await assert.rejects(vault.recoverSignOut(id))
  const pending = vault.signOut({ id, revoke: async () => new Promise(resolve => { finish = resolve }) })
  await new Promise(resolve => setImmediate(resolve))
  const reopened = createPlanVault({ credentials, key: 'plan' })
  assert.equal((await reopened.status()).accounts[0].revocationPending, true)
  await assert.rejects(reopened.recoverSignOut('wrong-id'))
  assert.deepEqual(await reopened.recoverSignOut(id), { remoteRevoked: false })
  assert.doesNotMatch(JSON.stringify(record), /old-access|old-refresh|old-id/)
  assert.equal((await reopened.status()).accounts[0].retired, true)
  await assert.rejects(reopened.registration(id))
  await assert.rejects(reopened.add({ ...grant, refreshToken: 'replacement' }, 'First'))
  await vault.add({ ...grant, clientId: 'new-client', refreshToken: 'new-refresh' }, 'New registration')
  finish()
  await assert.rejects(pending)
  assert.equal((await vault.readActive()).refreshToken, 'new-refresh')
  assert.equal((await vault.readActive()).clientId, 'new-client')
})

test('reading an unexpired grant does not write credentials or emit update notifications', async () => {
  let record, writes = 0
  const credentials = {
    readRecord: async () => structuredClone(record),
    modifyRecord: async (_key, update) => {
      const next = await update(structuredClone(record))
      if (next !== undefined) { record = structuredClone(next); writes++ }
      return structuredClone(record)
    },
  }
  const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
  const vault = createPlanVault({ credentials, key: 'plan', createId: () => ids.shift() })
  const hostId = await vault.hostId()
  await vault.add({ clientId: 'a', subject: 'a', hostId, accessToken: 'a', refreshToken: 'r', idToken: 'i', expiresAt: 100, scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }, 'First')
  const before = writes
  for (let i = 0; i < 3; i++) await vault.fresh({ now: 2, refresh: async () => assert.fail('unexpired grant was refreshed') })
  assert.equal(writes, before)
})
