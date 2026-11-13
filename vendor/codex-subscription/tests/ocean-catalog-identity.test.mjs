import assert from 'node:assert/strict'
import test from 'node:test'
import { createOfficialModelCatalog, CODEX_MODELS_URL } from '../src/model-catalog.js'
import { PACKAGE_VERSION, USER_AGENT } from '../src/version.js'

for (const subagent of [false, true]) {
  test(`Ocean catalog without nativeVersion uses a defined package version (subagent=${subagent})`, async () => {
    const requests = []
    const catalog = createOfficialModelCatalog({
      subagent,
      baseModels: () => [{ id: 'fixture-model', name: 'Fixture', input: ['text'] }],
      getAuth: async () => ({ auth: { apiKey: 'synthetic-token' } }),
      readCredential: async () => ({ type: 'oauth', access: 'synthetic-token', accountId: 'synthetic-account' }),
      fetch: async (input, init) => {
        requests.push({ input, init })
        return Response.json({ models: [{ slug: 'fixture-model', display_name: 'Fixture', visibility: 'list', supported_in_api: true, input_modalities: ['text'] }] })
      },
    })
    assert.equal(await catalog.refresh(), true)
    assert.equal(requests.length, 1)
    const { input, init } = requests[0]
    const url = new URL(input)
    assert.equal(input, CODEX_MODELS_URL)
    assert.equal(url.origin, 'https://chatgpt.com')
    assert.equal(url.pathname, '/backend-api/codex/models')
    assert.equal(url.searchParams.get('client_version'), PACKAGE_VERSION)
    assert.ok(PACKAGE_VERSION.length > 0)
    assert.notEqual(url.searchParams.get('client_version'), 'undefined')
    assert.equal(init.headers.originator, 'pi')
    assert.notEqual(init.headers.originator, 'codex_cli_rs')
    assert.equal(init.headers['user-agent'], USER_AGENT)
    assert.equal(init.redirect, 'error')
    catalog.clear()
  })
}

for (const [kind, fetch, expected] of [
  ['http', async () => new Response('private-response-body', { status: 403 }), { kind: 'http', httpStatus: 403 }],
  ['network', async () => { throw new Error('private-url-token') }, { kind: 'network' }],
  ['response', async () => new Response('invalid-private-json'), { kind: 'response' }],
  ['empty-catalog', async () => Response.json({ models: [] }), { kind: 'empty-catalog' }],
  ['no-visible-models', async () => Response.json({ models: [{ slug: 'private-model', visibility: 'hide' }] }), { kind: 'no-visible-models' }],
  ['missing-base-models', async () => Response.json({ models: [{ slug: 'private-model', visibility: 'list' }] }), { kind: 'missing-base-models' }],
]) {
  test(`catalog exposes only safe ${kind} diagnostics and clears them`, async () => {
    const catalog = createOfficialModelCatalog({
      baseModels: () => [],
      getAuth: async () => ({ auth: { apiKey: 'synthetic-token' } }),
      readCredential: async () => ({ type: 'oauth', access: 'synthetic-token', accountId: 'synthetic-account' }),
      fetch,
    })
    await assert.rejects(catalog.refresh())
    assert.deepEqual(catalog.status().failure, expected)
    assert.doesNotMatch(JSON.stringify(catalog.status()), /private|synthetic/)
    const status = catalog.status()
    status.failure.kind = 'mutated'
    assert.deepEqual(catalog.status().failure, expected)
    catalog.clear()
    assert.deepEqual(catalog.status(), { source: 'unavailable', refresh: 'idle' })
  })
}
