/** Join published releases to local bundle state by exact package name. */
import { installTarget } from './catalog.js'

/** @typedef {import('./catalog.js').PublishedPlugin} PublishedPlugin */
/** @typedef {import('./catalog.js').PublishedInstallTarget} PublishedInstallTarget */
/** @typedef {import('@ocean/ocean-api-remotes/client').BundleInfo} BundleInfo */
/** @typedef {{ kind: 'install', target: PublishedInstallTarget } | { kind: 'enable' | 'disable' | 'open' }} CardAction */

const badges = /** @type {const} */ ({
  on: 'badgeOn', off: 'badgeOff', blocked: 'badgeBlocked', broken: 'badgeBroken',
  incompatible: 'badgeIncompatible', missing: 'badgeMissing', unknown: 'badgeUnknown',
})

/**
 * Project a release and its matching profile record. Compatibility describes the published release, not the installed copy.
 * @param {PublishedPlugin} plugin a release the Host lists in the catalogue.
 * @param {BundleInfo | undefined} bundle the matching local bundle, if found.
 * @param {{fresh: boolean, inventoryReady: boolean, resolveText: (text: PublishedPlugin['title']) => string}} options
 * whether installation offers and inventory are current, and how offer text resolves to the active UI language.
 * @returns The card and its available actions.
 */
export function cardFor(plugin, bundle, { fresh, inventoryReady, resolveText }) {
  const { name, compatible, version: publishedVersion } = plugin
  const title = resolveText(plugin.title)
  const description = resolveText(plugin.description)
  const readable = bundle?.availability === 'installation' || bundle?.availability === 'profile'
  const configured = bundle?.installed === true || bundle?.enabled === true
  const selected = bundle?.enabled === true
  const error = bundle?.error?.code
  const canChange = bundle?.readOnlyReason === undefined
  const state = readable ? (error !== undefined ? 'blocked' : selected ? 'on' : 'off')
    : configured ? 'broken' : !compatible ? 'incompatible' : bundle !== undefined || inventoryReady ? 'missing' : 'unknown'
  /** @type {CardAction[]} */
  const actions = []
  if (readable || configured) {
    if (canChange && selected) actions.push({ kind: 'disable' })
    if (canChange && !selected && readable && error === undefined) actions.push({ kind: 'enable' })
    actions.push({ kind: 'open' })
  } else if (fresh && inventoryReady && compatible && canChange && error === undefined) {
    actions.push({ kind: 'install', target: installTarget(plugin, resolveText) })
  }

  return {
    name, title, description, compatible, publishedVersion, state, actions, error,
    search: [title, description, name].join(' ').toLowerCase(),
    version: readable ? bundle.version : undefined,
    installed: readable,
    enabled: readable && selected && error === undefined,
    badge: badges[state],
    note: state === 'broken' ? /** @type {const} */ ('noteBroken')
      : error === 'unsupported-platform' ? /** @type {const} */ ('noteUnsupported')
        : error !== undefined ? /** @type {const} */ ('noteError') : undefined,
  }
}

/**
 * Filter by a case-insensitive substring of the title, description or package name.
 * @param {ReturnType<typeof cardFor>[]} cards the card models in display order.
 * @param {string} query the search text; a blank query keeps every card.
 * @returns {ReturnType<typeof cardFor>[]} the matching cards, in their original order.
 */
export function filterCards(cards, query) {
  const needle = query.trim().toLowerCase()
  return needle.length === 0 ? cards : cards.filter(card => card.search.includes(needle))
}

/**
 * Build cards only for packages from the publication channel; inventory supplies state but cannot add cards.
 * @param {{plugins: readonly PublishedPlugin[], bundles: readonly BundleInfo[], fresh: boolean, inventoryReady: boolean,
 *   resolveText: (text: PublishedPlugin['title']) => string}} input current Host data and the active-language text resolver.
 * @returns {{cards: ReturnType<typeof cardFor>[], counts: {total: number, installed: number, enabled: number}}} the catalogue view.
 */
export function buildMarketView({ plugins, bundles, fresh, inventoryReady, resolveText }) {
  const byName = new Map(bundles.map(bundle => [bundle.name, bundle]))
  const options = { fresh, inventoryReady, resolveText }
  const cards = plugins.map(plugin => cardFor(plugin, byName.get(plugin.name), options))
  const counts = { total: cards.length, installed: 0, enabled: 0 }
  for (const card of cards) {
    if (card.installed) counts.installed += 1
    if (card.enabled) counts.enabled += 1
  }
  return { cards, counts }
}
