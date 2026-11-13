import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlanService } from '../src/chatgpt-plan-service.js'

test('successful user-initiated login commits only the new grant and lists account models', async () => {
  const writes = []
  const grant = { accessToken: 'private-access', expiresAt: Date.now() + 60000 }
  const vault = { hostId: async () => 'fixture-host', add: async value => { writes.push(value) }, status: async () => ({ activeId: 'fixture', accounts: [{ id: 'fixture', label: 'Work' }] }), fresh: async () => grant }
  let complete
  const request = async () => { throw new Error('unexpected request') }
  const startLogin = async options => { assert.equal(typeof options.exchange, 'function'); return { url: 'https://auth.openai.com/test', completion: new Promise(resolve => { complete = resolve }), cancel: async () => {} } }
  const service = createPlanService({ vault, startLogin, fetch: request, listModels: async ({ accessToken, fetch }) => { assert.equal(fetch, request); assert.equal(accessToken, 'private-access'); return [{ id: 'model-a', name: 'Model A' }] }, timeoutMs: 5000 })
  assert.equal((await service.start('Work')).phase, 'waiting_browser')
  complete(grant)
  await service.settle()
  assert.equal((await service.status()).phase, 'authenticated')
  assert.equal(writes.length, 1)
  assert.deepEqual(await service.models(), [{ id: 'model-a', name: 'Model A' }])
  assert.doesNotMatch(JSON.stringify(await service.status()), /private-access/)
})

test('cancelled login does not save a late grant', async () => {
  let complete, writes = 0
  const vault = { grantState: async () => 'absent', hostId: async () => 'fixture-host', add: async () => { writes++ }, status: async () => ({ accounts: [] }) }
  const startLogin = async () => ({ url: 'https://auth.openai.com/test', completion: new Promise(resolve => { complete = resolve }), cancel: async () => {} })
  let revocations = 0
  const service = createPlanService({ vault, startLogin, listModels: async () => [], fetch: async () => { revocations++; return new Response(null, { status: 200 }) }, timeoutMs: 5000 })
  await service.start('Work')
  await service.cancel()
  complete({ accessToken: 'private-access', refreshToken: 'private-refresh', clientId: 'fixture' })
  await service.settle()
  assert.equal(revocations, 1)
  assert.equal(writes, 0)
  assert.equal((await service.status()).phase, 'cancelled')
})

test('reauthorization uses the selected registration and never exposes it in status', async () => {
  const registration = { clientId: 'oaiapp_private', subject: 'private-subject' }
  const vault = { hostId: async () => 'fixture-host', registration: async id => { assert.equal(id, 'account-one'); return registration }, status: async () => ({ accounts: [] }), add: async () => {} }
  let complete
  const startLogin = async options => { assert.deepEqual(options.registration, registration); return { url: 'https://auth.openai.com/test', completion: new Promise(resolve => { complete = resolve }), cancel: async () => {} } }
  const service = createPlanService({ vault, startLogin, timeoutMs: 5000 })
  await service.start('Work', { renewId: 'account-one' })
  assert.doesNotMatch(JSON.stringify(await service.status()), /oaiapp_private|private-subject/)
  complete({})
  await service.settle()
})

test('a model list for a previous account is discarded after switching', async () => {
  let complete
  const vault = { status: async () => ({ activeId: 'account-one', accounts: [] }), fresh: async () => ({ accessToken: 'private-access' }), select: async () => {} }
  const service = createPlanService({ vault, timeoutMs: 5000, listModels: async () => new Promise(resolve => { complete = resolve }) })
  const listing = service.models()
  await new Promise(resolve => setImmediate(resolve))
  await service.select('account-two')
  complete([{ id: 'model-a', name: 'Model A' }])
  await assert.rejects(listing)
})

test('cancelled model request does not start a catalog fetch after credential refresh', async () => {
  const controller = new AbortController()
  let finish, calls = 0
  const vault = { status: async () => ({ activeId: 'account-one', accounts: [] }), fresh: async () => new Promise(resolve => { finish = resolve }) }
  const service = createPlanService({ vault, timeoutMs: 5000, listModels: async () => { calls++; return [] } })
  const request = service.models({ signal: controller.signal })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  finish({ accessToken: 'private' })
  await assert.rejects(request)
  assert.equal(calls, 0)
})

test('sign-out aborts a stalled revocation and reports an unconfirmed remote result', async () => {
  let sawAbort = false
  const vault = { signOut: async ({ revoke }) => { try { await revoke({ clientId: 'a', refreshToken: 'fake' }); return { remoteRevoked: true } } catch { return { remoteRevoked: false } } } }
  const service = createPlanService({ vault, timeoutMs: 100, revocationTimeoutMs: 10, revocationAttempts: 1, fetch: async (_input, init) => { init.signal.addEventListener('abort', () => { sawAbort = true }); return new Promise(() => {}) } })
  assert.deepEqual(await service.signOut('id'), { remoteRevoked: false })
  assert.equal(sawAbort, true)
})

test('account operations block token and catalog access while a selection is being saved', async () => {
  let finish, changed = 0
  const vault = { status: async () => ({ activeId: 'first', accounts: [] }), fresh: async () => ({ accessToken: 'private' }), select: async () => new Promise(resolve => { finish = resolve }) }
  const service = createPlanService({ vault, timeoutMs: 100, onAccountChanged: () => { changed++ } })
  const selecting = service.select('second')
  await assert.rejects(service.accessToken('first'))
  await assert.rejects(service.models())
  finish()
  await selecting
  assert.equal(changed, 2)
})

test('recovery invalidates account work and preserves the unconfirmed revocation warning', async () => {
  let recovered, changed = 0
  const vault = { recoverSignOut: async id => { recovered = id; return { remoteRevoked: false } }, status: async () => ({ accounts: [] }) }
  const service = createPlanService({ vault, onAccountChanged: () => { changed++ } })
  assert.deepEqual(await service.recoverSignOut('selected'), { remoteRevoked: false })
  assert.equal(recovered, 'selected')
  assert.equal(changed, 2)
  assert.equal((await service.status()).cleanupUnconfirmed, true)
})
