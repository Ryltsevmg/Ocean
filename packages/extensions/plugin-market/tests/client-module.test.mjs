/** The generated bundle mounts through the client module loader, registers the tab, and unwraps Remote answers. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

/** React stand-in: the tab renders only in a browser, so `apply` must not call hooks. */
const React = {
  createElement: () => undefined,
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useSyncExternalStore: () => undefined,
}

/**
 * Load the committed bundle into a bare context holding only `window`.
 * @returns {Promise<object>} the one module definition the bundle registers.
 */
async function loadBundle(globals = {}) {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  const definitions = []
  const sandbox = { window: { __ModuleLoader__: { load: definition => { definitions.push(definition) } } }, ...globals }
  vm.runInNewContext(source, sandbox, { filename: 'client.js' })
  assert.equal(definitions.length, 1)
  return definitions[0]
}

/**
 * Apply the plugin against a context whose Remote answers come from `pluginManager`.
 * @param {object} pluginManager the `remote.pluginManager` stand-in.
 * @param {object} [services] optional services `ctx.get` answers, such as `pluginNavigation`.
 * @returns {Promise<{ entry: object, dictionaries: object[], registrations: object[] }>} what apply
 *   registered; `entry` is the Plugins-page tab.
 */
async function applyWith(pluginManager, services, globals) {
  const definition = await loadBundle(globals)
  const plugin = definition.factory(() => React)
  const dictionaries = []
  const registrations = []
  const ctx = {
    effect: (fn) => { const dispose = fn(); return typeof dispose === 'function' ? dispose : () => {} },
    on: () => () => {},
    locale: {
      register: (namespace, dictionary) => { dictionaries.push({ namespace, dictionary }); return () => {} },
      bind: () => key => key,
      resolveText: localized => localized.en,
      subscribe: () => () => {},
    },
    get: name => services?.[name],
    remote: { $on: () => () => {}, pluginManager },
    slots: {
      inject: (name, register) => register(name),
      register: (entry, component) => { registrations.push({ entry, component }); return () => {} },
    },
  }
  plugin.apply(ctx)
  const tab = registrations.find(item => item.entry.name === 'plugins.tab')
  const sidebar = registrations.find(item => item.entry.name === 'sidebar.footer.action')
  assert.ok(tab, 'the Plugins-page tab must be registered')
  assert.equal(sidebar, undefined, 'Plugins has one launcher owned by the main sidebar')
  return { entry: tab.entry, dictionaries, registrations }
}

test('the bundle declares our module id and builds the plugin from the loader React', async () => {
  const definition = await loadBundle()
  assert.equal(definition.id, '@ocean/ocean-plugin-market')
  let requested
  const plugin = definition.factory((name) => { requested = name; return React })
  assert.equal(requested, 'react')
  assert.equal(plugin.inject.join(','), 'slots,locale,remote,remote.pluginManager')
  assert.equal(typeof plugin.apply, 'function')
})

test('apply registers the dictionary and one Plugins-page tab', async () => {
  const { entry, dictionaries } = await applyWith({})
  assert.equal(dictionaries.length, 1)
  assert.equal(dictionaries[0].namespace, 'pluginMarket')
  assert.deepEqual(Object.keys(dictionaries[0].dictionary).sort(), ['en', 'ru'])
  assert.equal(entry.name, 'plugins.tab')
  assert.equal(entry.id, 'our-plugins')
  assert.equal(entry.order, -10)
  assert.equal(entry.locale, 'pluginMarket')
  assert.equal(entry.label(), 'tab')
  assert.equal(typeof entry.inject().market.load, 'function')
})

test('the catalog does not inject footer controls or global sidebar styling', async () => {
  const appended = []
  const document = { createElement: () => ({ dataset: {} }), head: { append: element => { appended.push(element) } } }
  const { registrations } = await applyWith({}, {}, { document })
  assert.deepEqual(registrations.map(item => item.entry.name), ['plugins.tab'])
  assert.deepEqual(appended, [])
})

test('a Remote answer is unwrapped before the controller sees it', async () => {
  const bundles = [{ name: 'x', enabled: true, installed: true, removable: true, version: '1.0.0' }]
  const { entry } = await applyWith({ listBundles: async () => ({ ok: true, value: bundles }) })
  const market = entry.inject().market
  await market.load()
  const snapshot = market.getSnapshot()
  assert.equal(snapshot.status, 'ready')
  assert.equal(snapshot.cards.length > 0, true)
  assert.equal(snapshot.error, undefined)
})

test('a refused Remote answer surfaces the Host code, not a shape mismatch', async () => {
  const refusal = { ok: false, error: { code: 'plugin-manager/unknown-bundle', message: 'no managed profile' } }
  const { entry } = await applyWith({ listBundles: async () => refusal })
  const market = entry.inject().market
  await market.load()
  assert.equal(market.getSnapshot().status, 'error')
  assert.equal(market.getSnapshot().error, 'plugin-manager/unknown-bundle: no managed profile')
})
