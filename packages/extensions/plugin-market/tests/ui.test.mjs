/** DOM interactions of the catalogue with its page owner and an injected snapshot. */
import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { JSDOM } from 'jsdom'
import { fireEvent, getByRole, queryByRole, render, within } from '@testing-library/react/pure.js'
import { createMarketController } from '../src/controller.js'
import { en, ru, zh } from '../src/locales.js'
import { createMarketTab } from '../src/ui.js'

const h = React.createElement
const plugin = { name: '@ocean/approved', version: '2.0.0', title: 'Approved', description: 'Channel description', sha256: 'a'.repeat(64), compatible: true }
const { name, version, title, sha256 } = plugin

// Modal focus trapping belongs to the shared primitive; the catalogue owns the modal's presence and its actions.
function Modal({ title, onClose, closeLabel, children, footer }) {
  return h('div', { role: 'dialog', 'aria-label': title, tabIndex: -1 },
    h('button', { onClick: onClose }, closeLabel), children, footer)
}
// The Markdown renderer and default artwork are shared primitives; the catalogue only decides where they appear.
function MarkdownText({ text }) {
  return h('div', { 'data-markdown': '' }, text)
}
function PluginArtworkDefault() {
  return h('svg', { 'data-default-artwork': '' })
}
const primitives = { Modal, MarkdownText, PluginArtworkDefault }

async function fixture(t, { response = { status: 'ready', plugins: [plugin] }, bundles = [], dictionary = en } = {}) {
  const dom = new JSDOM('<!doctype html><body></body>')
  const restore = new Map()
  const { window } = dom
  let ui
  let market
  t.after(() => {
    try {
      ui?.unmount()
    } finally {
      market?.dispose()
      for (const [key, old] of restore) {
        if (old === undefined) delete globalThis[key]
        else Object.defineProperty(globalThis, key, old)
      }
      window.close()
    }
  })
  for (const [key, value] of Object.entries({ window, document: window.document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    restore.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const installed = []
  const opened = []
  const api = {
    response,
    bundles,
    async listPublishedCatalog() { return this.response },
    async listBundles() { return this.bundles },
    async setBundleEnabled(name, enabled) {
      this.bundles = this.bundles.map(bundle => bundle.name === name ? { ...bundle, enabled } : bundle)
      return { application: 'applied' }
    },
  }
  market = createMarketController(api, text => typeof text === 'string' ? text : text.en)
  const { MarketTab } = createMarketTab(React, primitives)
  let latestLoad
  const actions = {
    ...market,
    load() { return latestLoad = market.load() },
  }
  function useMarket(select) { return select(React.useSyncExternalStore(market.subscribe, market.getSnapshot)) }
  const translate = (key, params) => {
    assert.ok(Object.hasOwn(dictionary, key), key)
    return dictionary[key].replace(/\{(\w+)\}/gu, (_, key) => params[key])
  }
  await React.act(async () => {
    ui = render(h(MarketTab, { useMarket, t: translate, actions, installPublished: target => installed.push(target), openPackage: name => opened.push(name) }))
  })
  const panel = ui.container
  async function refresh() {
    await React.act(async () => {
      fireEvent.click(getByRole(panel, 'button', { name: dictionary.refresh }))
      await latestLoad
    })
  }
  return { api, market, panel, window, installed, opened, refresh }
}

test('a fresh compatible card and its details invoke only the owner callback with the exact publication', async t => {
  const { panel, installed } = await fixture(t)
  const card = within(getByRole(panel, 'article'))
  fireEvent.click(card.getByRole('button', { name: en.install }))
  assert.deepEqual(installed, [{ name, version, title, sha256 }])
  fireEvent.click(card.getByRole('button', { name: en.details }))
  const dialog = within(getByRole(panel, 'dialog', { name: title }))
  assert.ok(dialog.getByText(plugin.description))
  fireEvent.click(dialog.getByRole('button', { name: en.install }))
  assert.deepEqual(installed, [{ name, version, title, sha256 }, { name, version, title, sha256 }])
  assert.equal(queryByRole(panel, 'dialog'), null)
})

test('a cached refresh keeps details but removes install; withdrawal closes details and restores focus', async t => {
  const { panel, api, window, refresh, installed } = await fixture(t)
  const card = within(getByRole(panel, 'article'))
  const detailButton = card.getByRole('button', { name: en.details })
  detailButton.focus()
  fireEvent.click(detailButton)
  const dialog = getByRole(panel, 'dialog')
  within(dialog).getByRole('button', { name: en.install }).focus()
  api.response = { status: 'stale', plugins: [plugin] }
  await refresh()
  assert.ok(within(panel).getByText(en.cached))
  assert.equal(getByRole(panel, 'dialog'), dialog)
  assert.equal(queryByRole(panel, 'button', { name: en.install }), null)
  assert.equal(window.document.activeElement, dialog)
  assert.deepEqual(installed, [])

  api.response = { status: 'ready', plugins: [] }
  await refresh()
  assert.equal(queryByRole(panel, 'dialog'), null)
  assert.equal(queryByRole(panel, 'article'), null)
  assert.ok(within(panel).getByText(en.empty))
  assert.equal(window.document.activeElement, getByRole(panel, 'button', { name: en.refresh }))
})

test('toggling an installed copy keeps its details and focused control; Open goes to Installed', async t => {
  const bundles = [{ name, version: '1.0.0', availability: 'profile', installed: true, enabled: false }]
  const { panel, window, opened } = await fixture(t, { bundles })
  fireEvent.click(getByRole(panel, 'button', { name: en.details }))
  const dialog = within(getByRole(panel, 'dialog'))
  const toggle = dialog.getByRole('button', { name: en.enable })
  toggle.focus()
  await React.act(async () => { fireEvent.click(toggle) })
  assert.equal(dialog.getByRole('button', { name: en.disable }), toggle)
  assert.equal(window.document.activeElement, toggle)
  assert.ok(dialog.getByText(en.badgeOn))
  fireEvent.click(dialog.getByRole('button', { name: en.open }))
  assert.deepEqual(opened, [name])
  assert.equal(queryByRole(panel, 'dialog'), null)
})

for (const dictionary of [en, ru, zh]) {
  test(`unavailable with no cache is not a published empty state (${dictionary.tab})`, async t => {
    const { panel } = await fixture(t, { dictionary, response: { status: 'unavailable', plugins: [] } })
    assert.equal(getByRole(panel, 'alert').textContent, dictionary.unavailable)
    assert.equal(within(panel).queryByText(dictionary.empty), null)
  })
}

test('a published icon and long description reach the card and its details', async t => {
  const detail = { en: '# Approved\n\nA long description.', ru: '# Одобрено\n\nДлинное описание.' }
  const published = { ...plugin, icon: 'data:image/svg+xml;base64,PHN2Zy8+', detail }
  const { panel } = await fixture(t, { response: { status: 'ready', plugins: [published] } })
  const article = getByRole(panel, 'article')
  assert.equal(article.querySelector('img').getAttribute('src'), published.icon)
  assert.equal(within(article).getByText(plugin.description).textContent, plugin.description)
  assert.equal(article.querySelector('[data-markdown]'), null)

  fireEvent.click(within(article).getByRole('button', { name: en.details }))
  const dialog = getByRole(panel, 'dialog')
  // The document's own level-one heading is dropped: the dialog title already names the plugin.
  assert.equal(dialog.querySelector('[data-markdown]').textContent, 'A long description.')
  // The short description stays as the lead above the long one.
  assert.ok(within(dialog).getByText(plugin.description))
})

test('a release without artwork keeps the shared default glyph and no long section', async t => {
  const { panel } = await fixture(t)
  const article = getByRole(panel, 'article')
  assert.equal(article.querySelector('img'), null)
  assert.ok(article.querySelector('[data-default-artwork]'))
  fireEvent.click(within(article).getByRole('button', { name: en.details }))
  assert.equal(getByRole(panel, 'dialog').querySelector('[data-markdown]'), null)
})
