/** Independent catalogue and inventory reads and guarded install gestures. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createMarketController } from '../src/controller.js'

const plugin = {
  name: '@ocean/published', version: '2.1.0', title: { en: 'Published plugin', ru: 'Опубликованный плагин' },
  description: { en: 'From the channel', ru: 'Из канала' }, sha256: '2'.repeat(64), compatible: true,
}
const local = { name: plugin.name, availability: 'profile', enabled: false, installed: true }
const publication = (status, plugins = [plugin]) => ({ status, plugins })

function harness({ plugins = [plugin], bundles = [] } = {}) {
  const language = { active: 'en' }
  const resolveText = text => typeof text === 'string' ? text : text[language.active] ?? text.en
  const api = {
    catalog: publication('ready', plugins), bundles, calls: [],
    async listPublishedCatalog() { this.calls.push('catalog'); return this.catalog },
    async listBundles() { this.calls.push('inventory'); return this.bundles },
    async setBundleEnabled(name, enabled) {
      this.calls.push(['setBundleEnabled', name, enabled])
      this.bundles = this.bundles.map(bundle => bundle.name === name ? { ...bundle, enabled } : bundle)
      return { application: 'applied' }
    },
  }
  const market = createMarketController(api, resolveText)
  const card = () => market.getSnapshot().cards[0]
  return { market, api, card, language }
}

test('opening and invalidation read both Remote lists with no reads before opening or after disposal', async () => {
  const { market, api } = harness()
  await market.invalidate()
  assert.deepEqual(api.calls, [])
  const first = market.load()
  assert.deepEqual(api.calls, ['catalog', 'inventory'])
  await first
  await market.invalidate()
  assert.deepEqual(api.calls, ['catalog', 'inventory', 'catalog', 'inventory'])
  market.dispose()
  await market.invalidate()
  await market.load()
  assert.equal(api.calls.length, 4)
})

test('the last valid list stays visible offline but offers no installation', async () => {
  const { market, api, card } = harness()
  await market.load()
  const target = card().actions[0].target
  assert.deepEqual(market.getInstallTarget(target), target)

  const cached = { ...plugin, title: 'Later title in Host cache' }
  api.catalog = publication('stale', [cached])
  const pending = market.load()
  assert.equal(card().title, 'Published plugin')
  assert.equal(market.getInstallTarget(target), undefined)
  await pending
  assert.equal(market.getSnapshot().status, 'stale')
  assert.equal(card().title, cached.title)
  assert.deepEqual(card().actions, [])

  api.catalog = publication('unavailable', [])
  await market.load()
  assert.equal(market.getSnapshot().status, 'unavailable')
  assert.equal(market.getSnapshot().hasCatalog, true)
  assert.equal(card().title, cached.title)
  assert.equal(market.getInstallTarget(target), undefined)
})

test('the Host stale cache can seed a first open or replace a prior list with an authoritative empty cache', async () => {
  const { market, api, card } = harness()
  api.catalog = publication('stale')
  await market.load()
  assert.equal(card().title, 'Published plugin')
  assert.deepEqual(card().actions, [])
  api.catalog = publication('stale', [])
  await market.load()
  assert.equal(market.getSnapshot().hasCatalog, true)
  assert.deepEqual(market.getSnapshot().cards, [])
  api.catalog = publication('unavailable', [])
  await market.load()
  assert.equal(market.getSnapshot().hasCatalog, true)
})

test('an initial Remote rejection is unavailable, not an empty catalogue', async () => {
  const { market, api } = harness()
  api.listPublishedCatalog = async () => { throw new Error('offline') }
  await market.load()
  assert.equal(market.getSnapshot().status, 'unavailable')
  assert.equal(market.getSnapshot().hasCatalog, false)
  assert.deepEqual(market.getSnapshot().cards, [])
})

test('a withdrawn publication disappears without changing the profile', async () => {
  const { market, api } = harness({ bundles: [local] })
  await market.load()
  api.catalog = publication('ready', [])
  await market.invalidate()
  assert.equal(market.getSnapshot().status, 'ready')
  assert.deepEqual(market.getSnapshot().cards, [])
  assert.deepEqual(api.bundles, [local])
  assert.deepEqual(api.calls, ['catalog', 'inventory', 'catalog', 'inventory'])
})

test('an obsolete rendered click cannot install an offer whose version, hash, or approval changed', async () => {
  const { market, api, card } = harness()
  await market.load()
  const target = card().actions[0].target
  for (const plugins of [[{ ...plugin, sha256: '3'.repeat(64) }], [{ ...plugin, version: '2.2.0' }], []]) {
    api.catalog = publication('ready', plugins)
    await market.load()
    assert.equal(market.getInstallTarget(target), undefined)
  }
})

test('inventory rejection leaves published cards visible but prevents installs until a successful inventory read', async () => {
  const { market, api, card } = harness()
  const inventory = api.listBundles
  api.listBundles = async () => { throw new Error('offline') }
  await market.load()
  assert.equal(market.getSnapshot().status, 'ready')
  assert.equal(market.getSnapshot().inventory, 'unavailable')
  assert.equal(card().state, 'unknown')
  assert.deepEqual(card().actions, [])
  api.listBundles = inventory
  await market.load()
  assert.equal(market.getSnapshot().inventory, 'ready')
  assert.equal(card().actions[0].kind, 'install')
})

test('older in-flight answers cannot resurrect a withdrawn release or overwrite newer inventory', async () => {
  const { market, api } = harness()
  const oldCatalog = Promise.withResolvers()
  const oldInventory = Promise.withResolvers()
  const listCatalog = api.listPublishedCatalog
  const listInventory = api.listBundles
  api.listPublishedCatalog = () => oldCatalog.promise
  api.listBundles = () => oldInventory.promise
  const older = market.load()
  api.listPublishedCatalog = listCatalog
  api.listBundles = listInventory
  api.catalog = publication('ready', [])
  await market.invalidate()
  const newer = market.getSnapshot()
  oldCatalog.resolve(publication('ready'))
  oldInventory.resolve([local])
  await older
  assert.equal(market.getSnapshot(), newer)
  assert.deepEqual(newer.cards, [])
})

test('available local bundles can be toggled while the publication channel is cached', async () => {
  const { market, api, card } = harness({ bundles: [local] })
  api.catalog = publication('stale')
  await market.load()
  assert.equal(card().state, 'off')
  await market.setEnabled(plugin.name, true)
  assert.deepEqual(api.calls, ['catalog', 'inventory', ['setBundleEnabled', plugin.name, true], 'inventory'])
  assert.equal(card().state, 'on')
  assert.equal(market.getSnapshot().busy, undefined)
})

test('an unconfirmed change retains the card, rereads inventory, and reports the stable diagnostic code', async () => {
  const { market, api, card } = harness({ bundles: [local] })
  api.setBundleEnabled = async () => { throw Object.assign(new Error('internal transport detail'), { code: 'offline' }) }
  await market.load()
  await market.setEnabled(plugin.name, true)
  assert.equal(card().state, 'off')
  assert.deepEqual(api.calls, ['catalog', 'inventory', 'inventory'])
  assert.deepEqual(market.getSnapshot().notice, { title: 'transportError', diagnostic: 'offline' })
})

test('a locale switch republishes resolved card text without re-reading the Host', async () => {
  const { market, api, card, language } = harness()
  await market.load()
  let publications = 0
  market.subscribe(() => { publications += 1 })
  const rendered = card().actions[0].target
  language.active = 'ru'
  market.republish()
  assert.equal(card().title, 'Опубликованный плагин')
  assert.equal(card().description, 'Из канала')
  assert.deepEqual(api.calls, ['catalog', 'inventory'])
  assert.equal(publications, 1)
  const current = market.getInstallTarget(rendered)
  assert.deepEqual(current, { name: plugin.name, version: plugin.version, sha256: plugin.sha256, title: 'Опубликованный плагин' })
  market.dispose()
  market.republish()
  assert.equal(publications, 1)
})

test('a disposed controller discards pending Remote answers', async () => {
  const { market, api } = harness()
  const channel = Promise.withResolvers()
  const inventory = Promise.withResolvers()
  api.listPublishedCatalog = () => channel.promise
  api.listBundles = () => inventory.promise
  const pending = market.load()
  const snapshot = market.getSnapshot()
  let publications = 0
  market.subscribe(() => { publications += 1 })
  market.dispose()
  channel.resolve(publication('ready'))
  inventory.resolve([local])
  await pending
  assert.equal(market.getSnapshot(), snapshot)
  assert.equal(publications, 0)
})
