import assert from 'node:assert/strict'
import test from 'node:test'
import { restorePlanCatalog } from '../src/chatgpt-plan-startup.js'

test('restores the selected account catalog after Host startup', async () => {
  const calls = []
  const signal = new AbortController().signal
  const service = { status: async () => ({ activeId: 'selected', accounts: [{ id: 'selected', signedOut: false, reauthorizationRequired: false }] }), models: async options => { calls.push(options.signal); return [{ id: 'fixture' }] } }
  assert.deepEqual(await restorePlanCatalog(service, { signal }), [{ id: 'fixture' }])
  assert.deepEqual(calls, [signal])
})

test('does not start sign-in or read models for absent, signed-out, or untrusted grants', async () => {
  for (const status of [{ accounts: [] }, { activeId: 'a', accounts: [{ id: 'a', signedOut: true }] }, { activeId: 'a', accounts: [{ id: 'a', reauthorizationRequired: true }] }, { activeId: 'missing', accounts: [] }]) {
    let calls = 0
    const service = { status: async () => status, models: async () => { calls++; return [] } }
    assert.equal(await restorePlanCatalog(service, {}), undefined)
    assert.equal(calls, 0)
  }
})

test('startup cancellation prevents a late status result from starting a model request', async () => {
  let finish, calls = 0
  const signal = new AbortController()
  const service = { status: () => new Promise(resolve => { finish = resolve }), models: async () => { calls++; return [] } }
  const pending = restorePlanCatalog(service, { signal: signal.signal })
  signal.abort()
  finish({ activeId: 'a', accounts: [{ id: 'a' }] })
  await assert.rejects(pending)
  assert.equal(calls, 0)
})

test('startup restoration publishes supported account models through the model adapter', async () => {
  const { openaiProvider } = await import('@earendil-works/pi-ai/providers/openai')
  const { PiAiAdapter } = await import('@ocean/ocean-llm-pi-ai')
  const { createPlanProvider } = await import('../src/chatgpt-plan-provider.js')
  const base = openaiProvider(), known = base.getModels().find(model => model.api === 'openai-responses')
  const plan = createPlanProvider({ base, fetch: async () => { throw new Error('unexpected request') } })
  let published = 0
  const service = { status: async () => ({ activeId: 'saved', accounts: [{ id: 'saved' }] }), models: async () => { plan.update([{ id: known.id, name: known.name }]); published++; return plan.provider.getModels() } }
  await restorePlanCatalog(service, {})
  const profile = { provider: 'ocean-chatgpt-plan', displayName: 'ChatGPT plan', piProvider: plan.provider, configuredMaxTokens: new Map(), modelErrors: new Map() }
  const profiles = new Map([['ocean-chatgpt-plan', profile]])
  const adapter = new PiAiAdapter({ profiles: () => profiles, resolveApiKey: async () => 'fixture', auth: { credentials: { read: async () => undefined }, authContext: { env: async () => undefined, fileExists: async () => false } } })
  assert.equal(published, 1)
  assert.deepEqual((await adapter.listModels('ocean-chatgpt-plan')).map(item => item.id), [known.id])
})
