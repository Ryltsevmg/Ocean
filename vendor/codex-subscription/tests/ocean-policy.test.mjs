import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OCEAN_LOCKED_SETTINGS, oceanSettings, assertOceanSettingsPatch, withOceanRpcPolicy, withOceanNetworkPolicy } from '../src/ocean-policy.js'
import { createSettingsAdapter } from '../src/settings-adapter.js'
import { RPC_ENDPOINTS } from '../src/rpc-contract.js'

test('Ocean constrains loaded configuration and rejects enabling writes atomically', () => {
  let notify
  const writes = []
  const config = { remoteControl: 'on', imageGeneration: true, otherModels: 'on', quickQuotaMode: 'bar' }
  const ctx = { settings: { configure() {}, update: (...args) => writes.push(args) }, effect() {}, fiber: { entry: { id: 'ocean' }, effectiveConfig: config }, on: (_, fn) => { notify = fn; return () => {} } }
  const settings = createSettingsAdapter(ctx, {}, { read: oceanSettings, validate: assertOceanSettingsPatch })
  for (const [field, value] of Object.entries(OCEAN_LOCKED_SETTINGS)) assert.equal(settings.get()[field], value)
  assert.equal(settings.get().quickQuotaMode, 'bar')
  assert.throws(() => settings.update({ remoteControl: 'on', quickQuotaMode: 'off' }), /unavailable/)
  assert.equal(writes.length, 0)
  settings.update({ quickQuotaMode: 'off' })
  assert.equal(writes.length, 1)
  let seen
  settings.watch(value => { seen = value }); config.remoteControl = 'on'; notify()
  assert.equal(seen.remoteControl, 'off')
})

test('every advanced and unknown RPC is rejected before handler side effects', async () => {
  const calls = []
  const run = withOceanRpcPolicy((...args) => { calls.push(args); return { ok: true } })
  for (const endpoint of RPC_ENDPOINTS.filter(name => /^(remote|voice|runtime|reset-credit|image|sketch|predictions)\//u.test(name)).concat(['unknown', 'remote/enable/extra'])) {
    assert.equal((await run(endpoint, { captureAllowed: true }, new AbortController().signal)).error.code, 'unavailable', endpoint)
  }
  assert.equal(calls.length, 0)
  for (const endpoint of ['status', 'login/start', 'login/cancel', 'logout', 'usage', 'preferences/models', 'preferences/status']) assert.equal((await run(endpoint, {})).ok, true)
  assert.equal(calls.length, 7)
})

test('network policy rejects advanced provider calls outside RPC', () => {
  const calls = []
  const network = withOceanNetworkPolicy({ run: (...args) => calls.push(args), fetch: (...args) => calls.push(args), refreshOAuth: () => 'refresh' })
  for (const area of ['remote', 'voice', 'search', 'image', 'connectors', 'predictions', 'quota-reset', 'unknown']) {
    assert.throws(() => network.run(area, () => {}), /unavailable/)
    assert.throws(() => network.fetch(area, 'https://example.invalid'), /unavailable/)
  }
  assert.equal(calls.length, 0)
  for (const area of ['model', 'login', 'oauth', 'catalog', 'quota']) network.run(area, () => {})
  assert.equal(calls.length, 5)
  assert.equal(network.refreshOAuth(), 'refresh')
})

test('host entry uses isolated credentials, guards and does not register native execution', () => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  assert.match(source, /credentialRef\('OCEAN_CODEX_SUBSCRIPTION_OAUTH'\)/u)
  assert.match(source, /credentialKey\('ocean-codex-subscription', 'accounts'\)/u)
  assert.doesNotMatch(source, /WSL043_OPENAI_CODEX_OAUTH|LEGACY_CREDENTIAL_REF|registerProvider\(instance\.provider\)|DSH_CODEX_REMOTE_BASE/u)
  assert.match(source, /withOceanRpcPolicy\(diagnosticOperations/u)
  assert.match(source, /withOceanNetworkPolicy\(createCodexNetworkTransport/u)
})

 test('Ocean does not modify host web providers, persist diagnostics or reuse donor cache paths', () => {
  const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  const apply = source.slice(source.indexOf('export function apply('))
  assert.doesNotMatch(apply, /searchProviders\s*=|fetchProviders\s*=|registerSearchProvider\(|registerFetchProvider\(|searchProvider\.select\(|diagnosticLog\.attach\(/u)
  assert.doesNotMatch(apply, /dshHomePath\('state', 'codex-subscription'/u)
  assert.match(apply, /dshHomePath\('state', 'ocean-codex-subscription'/u)
})
