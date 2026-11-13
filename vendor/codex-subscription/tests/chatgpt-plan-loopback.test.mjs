import assert from 'node:assert/strict'
import test from 'node:test'
import { startPlanLogin } from '../src/chatgpt-plan-loopback.js'

test('loopback rejects unrelated callbacks and consumes the authorized callback once', async () => {
  let exchanges = 0
  const login = await startPlanLogin({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', timeoutMs: 5000, exchange: async () => { exchanges++; return { subject: 'fixture' } } })
  const authorization = new URL(login.url), callback = new URL(authorization.searchParams.get('redirect_uri'))
  callback.search = new URLSearchParams({ state: 'wrong', code: 'fixture', client_id: 'oaiapp_fixture' }).toString()
  assert.equal((await fetch(callback)).status, 400)
  assert.equal(exchanges, 0)
  callback.searchParams.set('state', authorization.searchParams.get('state'))
  assert.equal((await fetch(callback)).status, 200)
  assert.deepEqual(await login.completion, { subject: 'fixture' })
  assert.equal(exchanges, 1)
})

test('cancel settles the pending login and closes the listener', async () => {
  const login = await startPlanLogin({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', timeoutMs: 5000 })
  const rejected = assert.rejects(login.completion)
  await login.cancel()
  await rejected
  const redirect = new URL(new URL(login.url).searchParams.get('redirect_uri'))
  await assert.rejects(fetch(redirect))
})

test('cancel during exchange closes the browser response and ignores late success', async () => {
  let start, finish
  const started = new Promise(resolve => { start = resolve })
  const login = await startPlanLogin({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', timeoutMs: 5000, exchange: () => { start(); return new Promise(resolve => { finish = resolve }) } })
  const auth = new URL(login.url), callback = new URL(auth.searchParams.get('redirect_uri'))
  callback.search = new URLSearchParams({ state: auth.searchParams.get('state'), code: 'fixture', client_id: 'oaiapp_fixture' }).toString()
  const response = fetch(callback)
  await started
  const rejected = assert.rejects(login.completion)
  await login.cancel()
  await rejected
  assert.equal((await response).status, 400)
  finish({ subject: 'late' })
})
