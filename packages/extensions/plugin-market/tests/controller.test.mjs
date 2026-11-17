/** Behaviour of the market controller against a fake plugin-manager Remote. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createMarketController } from '../src/controller.js'
import { buildMarketView } from '../src/view.js'

/** Resolve catalogue strings the way the browser does. */
const text = localized => localized.ru ?? localized.en

/** Two catalogue entries; only the first is registered as a registry-updatable bundle. */
const catalog = [
  { name: '@local/pkg-a', version: '0.2.0', title: { en: 'A', ru: 'А' }, summary: { en: 'a', ru: 'а' } },
  { name: '@local/pkg-b', version: '1.0.0', title: { en: 'B', ru: 'Б' }, summary: { en: 'b', ru: 'б' } },
]

/** A Remote stand-in that records calls and keeps its own bundle list. */
function fakeApi(bundles) {
  return {
    bundles,
    calls: [],
    failure: undefined,
    async listBundles() {
      this.calls.push(['listBundles'])
      if (this.failure !== undefined) throw this.failure
      return this.bundles
    },
    async setBundleEnabled(name, enabled) {
      this.calls.push(['setBundleEnabled', name, enabled])
      this.bundles = this.bundles.map(bundle => bundle.name === name ? { ...bundle, enabled } : bundle)
    },
    async removeBundle(name) {
      this.calls.push(['removeBundle', name])
      this.bundles = this.bundles.filter(bundle => bundle.name !== name)
    },
    async updateBundle(name, version) {
      this.calls.push(['updateBundle', name, version])
    },
  }
}

/** The controller under test with its real projection. */
function controllerFor(api) {
  return createMarketController({ api, catalog, text, buildView: buildMarketView })
}

test('load publishes the projected cards and clears the busy marker', async () => {
  const api = fakeApi([{ name: '@local/pkg-a', version: '0.2.0', enabled: false, installed: false, removable: false }])
  const controller = controllerFor(api)
  assert.equal(controller.getSnapshot().status, 'loading')
  await controller.load()
  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.status, 'ready')
  assert.deepEqual(snapshot.counts, { total: 2, installed: 1, enabled: 0 })
  assert.deepEqual(snapshot.cards.map(card => card.state), ['off', 'unavailable'])
  assert.equal(snapshot.busy, undefined)
})

test('a failing load is reported, kept as a retryable error, and does not throw', async () => {
  const api = fakeApi([])
  api.failure = new Error('profile not writable')
  const controller = controllerFor(api)
  await controller.load()
  assert.equal(controller.getSnapshot().status, 'error')
  assert.equal(controller.getSnapshot().error, 'profile not writable')
})

test('subscribe observes publishes and stops after unsubscribe', async () => {
  const controller = controllerFor(fakeApi([]))
  let notifications = 0
  const unsubscribe = controller.subscribe(() => { notifications += 1 })
  await controller.load()
  assert.ok(notifications > 0)
  const seen = notifications
  unsubscribe()
  await controller.load()
  assert.equal(notifications, seen)
})

test('setEnabled calls the Remote and re-reads the list', async () => {
  const api = fakeApi([{ name: '@local/pkg-a', version: '0.2.0', enabled: false, installed: false, removable: false }])
  const controller = controllerFor(api)
  await controller.load()
  await controller.setEnabled('@local/pkg-a', true)
  assert.deepEqual(api.calls.filter(call => call[0] === 'setBundleEnabled'), [['setBundleEnabled', '@local/pkg-a', true]])
  assert.equal(api.calls.filter(call => call[0] === 'listBundles').length, 2)
  assert.equal(controller.getSnapshot().cards[0].state, 'on')
})

test('a failed action reports the kind and the message', async () => {
  const api = fakeApi([{ name: '@local/pkg-a', version: '0.2.0', enabled: false, installed: false, removable: false }])
  api.setBundleEnabled = async () => { throw new Error('locked') }
  const controller = controllerFor(api)
  await controller.load()
  await controller.setEnabled('@local/pkg-a', true)
  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.error, 'enable: locked')
  assert.equal(snapshot.busy, undefined)
})

test('remove and update forward their targets', async () => {
  const api = fakeApi([{ name: '@local/pkg-a', version: '0.2.0', enabled: true, installed: true, removable: true, update: 'registry' }])
  const controller = controllerFor(api)
  await controller.load()
  await controller.remove('@local/pkg-a')
  assert.deepEqual(api.calls.filter(call => call[0] === 'removeBundle'), [['removeBundle', '@local/pkg-a']])
  await controller.update('@local/pkg-a', '0.3.0')
  assert.deepEqual(api.calls.filter(call => call[0] === 'updateBundle'), [['updateBundle', '@local/pkg-a', '0.3.0']])
})

test('invalidations do not read the Host before the catalog opens', async () => {
  let reads = 0
  const market = createMarketController({ api: { listBundles: async () => { reads += 1; return [] } }, catalog, text, buildView: buildMarketView })
  market.invalidate()
  assert.equal(reads, 0)
  await market.load()
  market.invalidate()
  assert.equal(reads, 2)
  market.dispose()
  market.invalidate()
  assert.equal(reads, 2)
})
