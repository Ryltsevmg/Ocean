/** The committed loader module wires up the tab, dictionaries, Remote results and cleanup. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const React = { createElement: () => undefined }
const plugin = { name: '@ocean/approved', version: '1.0.0', title: 'Approved', description: 'An approved release.', sha256: '1'.repeat(64), compatible: true }
const ok = value => ({ ok: true, value })
const published = plugins => ok({ status: 'ready', plugins })

async function loadBundle(globals = {}) {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  const definitions = []
  const sandbox = { window: { __ModuleLoader__: { load: definition => { definitions.push(definition) } } }, ...globals }
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert.equal(definitions.length, 1)
  return definitions[0]
}

async function applyWith(t, pluginManager, globals) {
  const definition = await loadBundle(globals)
  const dictionaries = []
  const registrations = []
  const listeners = new Map()
  const disposers = []
  function on(event, handler) {
    listeners.set(event, handler)
    return () => { listeners.delete(event) }
  }
  t.after(() => disposers.reverse().forEach(dispose => dispose()))
  definition.factory(() => React).apply({
    effect: effect => disposers.push(effect()),
    on,
    locale: {
      register: (namespace, dictionary) => {
        dictionaries.push({ namespace, dictionary })
        return () => { dictionaries.pop() }
      },
      bind: () => key => key,
    },
    remote: { $on: on, pluginManager },
    slots: {
      inject: (name, register) => disposers.push(register(name)),
      register: entry => { registrations.push(entry); return () => { registrations.pop() } },
    },
  })
  const entry = registrations.find(entry => entry.name === 'plugins.tab')
  assert.ok(entry)
  return { entry, dictionaries, registrations, listeners, dispose: () => { while (disposers.length > 0) disposers.pop()() } }
}

test('the bundle declares the module and asks its loader for the shared React and modal', async () => {
  const definition = await loadBundle()
  assert.equal(definition.id, '@ocean/ocean-plugin-market')
  const requested = []
  const market = definition.factory(name => { requested.push(name); return React })
  assert.deepEqual(requested, ['react', '@ocean/ocean-client-ui-primitives'])
  assert.equal(market.inject.join(','), 'slots,locale,remote,remote.pluginManager')
  assert.equal(typeof market.apply, 'function')
})

test('apply registers English, Russian and Chinese UI copy and exactly one Plugins-page tab', async t => {
  const { entry, dictionaries, registrations } = await applyWith(t, {})
  assert.equal(dictionaries.length, 1)
  assert.equal(dictionaries[0].namespace, 'pluginMarket')
  assert.deepEqual(Object.keys(dictionaries[0].dictionary).sort(), ['en', 'ru', 'zh'])
  for (const language of ['ru', 'zh']) {
    const dictionary = dictionaries[0].dictionary[language]
    assert.deepEqual(Object.keys(dictionary), Object.keys(dictionaries[0].dictionary.en))
    for (const key of ['empty', 'cached', 'unavailable', 'badgeIncompatible', 'inventoryUnavailable']) {
      assert.ok(dictionary[key].length > 0)
      assert.notEqual(dictionary[key], dictionaries[0].dictionary.en[key])
    }
  }
  assert.deepEqual(registrations.map(entry => entry.name), ['plugins.tab'])
  assert.equal(entry.id, 'our-plugins')
  // Installed leads and opens by default; the catalogue follows it.
  assert.equal(entry.order, 10)
  assert.equal(entry.locale, 'pluginMarket')
  assert.equal(entry.label(), 'tab')
})

test('the bundle unwraps both Remote lists and invalidates on profile and connection changes', async t => {
  const calls = []
  const { entry, listeners, dispose } = await applyWith(t, {
    listPublishedCatalog: async () => { calls.push('catalog'); return published([plugin]) },
    listBundles: async () => { calls.push('inventory'); return ok([]) },
  })
  const { hooks, actions } = entry.inject()
  listeners.get('plugin-manager/changed')()
  assert.deepEqual(calls, [])
  await actions.load()
  assert.equal(hooks.market.getSnapshot().status, 'ready')
  assert.equal(hooks.market.getSnapshot().cards[0].actions[0].kind, 'install')
  listeners.get('plugin-manager/changed')()
  listeners.get('connection/reset')()
  assert.deepEqual(calls, ['catalog', 'inventory', 'catalog', 'inventory', 'catalog', 'inventory'])
  const snapshot = hooks.market.getSnapshot()
  dispose()
  assert.equal(listeners.size, 0)
  assert.equal(hooks.market.getSnapshot(), snapshot)
})

test('a refused catalogue request does not spoil the successful independent inventory read', async t => {
  const refusal = { ok: false, error: { code: 'access-denied', message: 'Internal diagnostic' } }
  const { entry } = await applyWith(t, {
    listBundles: async () => ok([]),
    listPublishedCatalog: async () => refusal,
  })
  const { hooks, actions } = entry.inject()
  await actions.load()
  const snapshot = hooks.market.getSnapshot()
  assert.equal(snapshot.status, 'unavailable')
  assert.equal(snapshot.inventory, 'ready')
  assert.equal(snapshot.hasCatalog, false)
})

test('an RPC success carrying a failed change keeps the card and reports the refusal', async t => {
  const bundle = { name: plugin.name, availability: 'profile', enabled: true, installed: true, version: '1.0.0' }
  const { entry } = await applyWith(t, {
    listPublishedCatalog: async () => published([plugin]),
    listBundles: async () => ok([bundle]),
    setBundleEnabled: async () => ok({ application: 'failed', error: { code: 'management-required' } }),
  })
  const { hooks, actions } = entry.inject()
  await actions.load()
  await actions.setEnabled(plugin.name, false)
  const snapshot = hooks.market.getSnapshot()
  assert.equal(snapshot.cards[0].state, 'on')
  assert.equal(snapshot.notice.title, 'failed')
  assert.equal(snapshot.notice.diagnostic, 'management-required')
})
