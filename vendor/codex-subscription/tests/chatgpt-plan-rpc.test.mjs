import assert from 'node:assert/strict'
import test from 'node:test'
import { withOceanRpcPolicy } from '../src/ocean-policy.js'
import { createPlanRpcHandler } from '../src/chatgpt-plan-rpc.js'

test('RPC opens only the host-validated sign-in URL and returns no URL or grant to the client', async () => {
  const opened = []
  const service = { start: async () => ({ phase: 'waiting_browser', url: 'https://auth.openai.com/test?state=private-state' }), status: async () => ({ phase: 'waiting_browser', accounts: [] }), cancel: async () => {}, models: async () => [] }
  const handler = createPlanRpcHandler({ service, openExternal: async url => { opened.push(url) } })
  const result = await handler('plan/login/start', { label: 'Work' })
  assert.equal(opened.length, 1)
  assert.equal(result.ok, true)
  assert.doesNotMatch(JSON.stringify(result), /private-state|auth.openai.com/)
})

test('RPC rejects invalid labels and redacts errors from login and catalog', async () => {
  let cancelled = 0
  const service = { start: async () => { throw new Error('private-access-token') }, status: async () => ({ phase: 'idle', accounts: [] }), cancel: async () => { cancelled++ }, models: async () => { throw new Error('private-access-token') } }
  const handler = withOceanRpcPolicy(createPlanRpcHandler({ service, openExternal: async () => {} }))
  assert.equal((await handler('plan/login/start', { label: '' })).ok, false)
  assert.doesNotMatch(JSON.stringify(await handler('plan/login/start', { label: 'Work' })), /private-access-token/)
  assert.doesNotMatch(JSON.stringify(await handler('plan/models', {})), /private-access-token/)
  assert.equal(cancelled, 0)
})

test('a browser-opening failure cancels only the newly started attempt', async () => {
  let cancelled = 0
  const service = { start: async () => ({ url: 'https://auth.openai.com/test' }), cancel: async () => { cancelled++ } }
  const handler = createPlanRpcHandler({ service, openExternal: async () => { throw new Error('unavailable') } })
  assert.equal((await handler('plan/login/start', { label: 'Work' })).ok, false)
  assert.equal(cancelled, 1)
})

test('RPC forwards only validated registration identifiers', async () => {
  const selected = []
  const service = { select: async id => { selected.push(id) }, status: async () => ({ phase: 'idle', accounts: [] }) }
  const handler = withOceanRpcPolicy(createPlanRpcHandler({ service, openExternal: async () => {} }))
  assert.equal((await handler('plan/account/select', { id: '../invalid' })).ok, false)
  assert.equal((await handler('plan/account/select', { id: 'account-123' })).ok, true)
  assert.deepEqual(selected, ['account-123'])
})

test('recovery requires explicit confirmation and validates the selected identifier', async () => {
  let recovered
  const service = { recoverSignOut: async id => { recovered = id; return { remoteRevoked: false } }, status: async () => ({ accounts: [] }) }
  const handler = withOceanRpcPolicy(createPlanRpcHandler({ service, openExternal: async () => {} }))
  assert.equal((await handler('plan/account/recover-sign-out', { id: 'a' })).ok, false)
  assert.equal((await handler('plan/account/recover-sign-out', { id: '../a', confirm: true })).ok, false)
  assert.equal(recovered, undefined)
  assert.equal((await handler('plan/account/recover-sign-out', { id: 'a', confirm: true })).ok, true)
  assert.equal(recovered, 'a')
})
