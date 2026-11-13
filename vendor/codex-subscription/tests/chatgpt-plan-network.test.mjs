import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlanNetwork } from '../src/chatgpt-plan-network.js'

test('plan network allows only the documented HTTPS endpoints through the owned transport', async () => {
  const calls = []
  const network = createPlanNetwork({ fetch: async (...args) => { calls.push(args); return new Response('{}') } })
  await network.fetch('https://auth.openai.com/api/accounts/oauth/token', { method: 'POST' })
  await network.fetch('https://auth.openai.com/.well-known/jwks.json', { method: 'GET' })
  await network.fetch('https://api.openai.com/v1/models', { method: 'GET' })
  assert.equal(calls.length, 3)
  await assert.rejects(network.fetch('https://evil.example/v1/models', { method: 'GET' }))
  await assert.rejects(network.fetch('https://api.openai.com/v1/models?private=1', { method: 'GET' }))
  await assert.rejects(network.fetch('https://api.openai.com/v1/models', { method: 'POST' }))
  assert.equal(calls.length, 3)
})
