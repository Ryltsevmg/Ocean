/**
 * Pure projection of the curated catalogue onto the Host's bundle list. It
 * decides what each card says and which management action it offers; it reads
 * no service, keeps no state, and is exercised directly by `tests/view.test.mjs`.
 */

/** Numeric ordering of two semver strings; an unparseable operand compares equal. */
export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (a === undefined || b === undefined) return 0
  for (const part of ['major', 'minor', 'patch']) {
    if (a[part] !== b[part]) return a[part] < b[part] ? -1 : 1
  }
  if (a.pre === undefined && b.pre === undefined) return 0
  // A release outranks any prerelease of the same version.
  if (a.pre === undefined) return 1
  if (b.pre === undefined) return -1
  const length = Math.max(a.pre.length, b.pre.length)
  for (let index = 0; index < length; index += 1) {
    const one = a.pre[index]
    const other = b.pre[index]
    if (one === undefined) return -1
    if (other === undefined) return 1
    if (one === other) continue
    const oneNumeric = /^\d+$/u.test(one)
    const otherNumeric = /^\d+$/u.test(other)
    if (oneNumeric !== otherNumeric) return oneNumeric ? -1 : 1
    if (oneNumeric && one.length !== other.length) return one.length < other.length ? -1 : 1
    return one < other ? -1 : 1
  }
  return 0
}

/**
 * @param {string} value
 * @returns {{ major: number, minor: number, patch: number, pre?: string[] } | undefined} parsed parts, or undefined.
 */
function parseVersion(value) {
  if (typeof value !== 'string') return undefined
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(value.trim())
  if (match === null) return undefined
  const parsed = { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
  return match[4] === undefined ? parsed : { ...parsed, pre: match[4].split('.') }
}

/** Management error text a card shows verbatim beside the Host's code. */
function errorText(error) {
  if (error === undefined) return undefined
  const code = typeof error.code === 'string' ? error.code : 'unknown'
  return typeof error.diagnostic === 'string' && error.diagnostic.length > 0 ? `${code}: ${error.diagnostic}` : code
}

/**
 * Project one catalogue entry into a card.
 * @param {object} entry catalogue entry.
 * @param {object | undefined} bundle the Host's record for that package name, if it lists one.
 * @param {{ text: (localized: unknown) => string }} options `text` resolves the catalogue's localized strings.
 * @returns {object} card model consumed by the tab.
 */
export function cardFor(entry, bundle, options) {
  const text = options.text
  const details = entry.details
  const about = details === undefined ? '' : text(details.about)
  const points = details === undefined ? [] : details.points.map(point => text(point))
  const readable = isReadable(bundle)
  const configured = bundle?.installed === true || bundle?.enabled === true
  const selected = bundle?.enabled === true
  const installedVersion = readable ? bundle.version : undefined
  const target = bundle?.installTarget
  const error = errorText(bundle?.error)
  const canChange = bundle?.readOnlyReason === undefined
  const isSelf = entry.self === true
  const state = isSelf ? 'self' : readable ? (error !== undefined ? 'blocked' : selected ? 'on' : 'off') : configured ? 'broken' : 'missing'
  const actions = []
  let note

  if (state === 'missing' && error === undefined && canChange) {
    if (bundle?.official === true) {
      if (target !== undefined) actions.push({ kind: 'installOfficial' })
    } else {
      actions.push({ kind: 'installForm', spec: entry.name })
      note = 'noteNoSource'
    }
  }
  if (!isSelf && (readable || configured)) {
    if (canChange && selected) actions.push({ kind: 'disable' })
    if (canChange && !selected && readable && error === undefined) actions.push({ kind: 'enable' })
    if (canChange && bundle.removable === true) actions.push({ kind: 'remove' })
    actions.push({ kind: 'open' })
  }

  if (state === 'broken') {
    // Adding over a recorded dependency is refused by the Host; its profile entry must be removed first.
    note = 'noteBroken'
  } else if (error !== undefined) {
    note = bundle.error.code === 'unsupported-platform' ? 'noteUnsupported' : 'noteError'
  } else if (!isSelf && readable) {
    const curatedNewer = typeof entry.version === 'string' && typeof installedVersion === 'string'
      && compareVersions(entry.version, installedVersion) > 0
    if (bundle.update === 'git') {
      note = 'noteGitUpdate'
    } else if (curatedNewer && bundle.update === 'registry' && canChange) {
      actions.unshift({ kind: 'update', version: entry.version })
    } else if (curatedNewer) {
      note = bundle.availability === 'installation' ? 'noteBuildCarried' : 'noteSourceUpdate'
    } else if (bundle.optional === true) {
      note = 'noteShipped'
    }
  }

  const title = text(entry.title)
  const summary = text(entry.summary)
  const bundleName = bundle?.name ?? entry.name
  return {
    id: entry.name,
    name: bundleName,
    title,
    summary,
    about,
    points,
    // One lowercased haystack per card: the search matches what the card and its popup show, and the package name.
    search: [title, summary, entry.name, ...(entry.aliases ?? []), about, ...points].join(' ').toLowerCase(),
    version: installedVersion ?? (!configured && error === undefined ? target?.version : undefined),
    installed: readable,
    enabled: selected && readable && error === undefined,
    state,
    badge: `badge${state[0].toUpperCase()}${state.slice(1)}`,
    actions,
    note,
    error,
  }
}

/** Native subagents and internal components are managed from Installed, not as catalogue products. */
const HIDDEN_HOST_BUNDLES = new Set([
  '@ocean/ocean-subagent-codex',
  '@ocean/ocean-subagent-claude-code',
  '@ocean/ocean-experimental-inspector',
  '@ocean/ocean-experimental-session-inspector',
  '@ocean/ocean-experimental-tool-worktree',
])

const THEME_PALETTE_PREFIX = '@local/ocean-theme-'

/** Whether the Host can read the bundle's files. */
function isReadable(bundle) {
  return bundle?.availability === 'installation' || bundle?.availability === 'profile'
}

/**
 * Choose a bundle for the card, preferring a usable copy over failed or unavailable alternatives.
 * @param {object} entry catalogue entry.
 * @param {Map<string, object>} byName Host bundles by package name.
 * @returns {object | undefined} the bundle the card acts on.
 */
function bundleFor(entry, byName) {
  const candidates = [entry.name, ...(entry.aliases ?? [])].map(name => byName.get(name)).filter(Boolean)
  const usable = candidates.filter(bundle => isReadable(bundle) && bundle.error === undefined)
  return usable.find(bundle => bundle.enabled) ?? usable.find(bundle => bundle.installed) ?? usable[0]
    ?? candidates.find(bundle => bundle.enabled || bundle.installed) ?? candidates[0]
}

/** Build a card entry for a Host bundle the curated catalogue does not name. */
function entryForBundle(bundle) {
  return {
    name: bundle.name,
    title: bundle.meta?.title ?? bundle.name,
    summary: bundle.meta?.description ?? bundle.description ?? '',
  }
}

/**
 * Filter the cards by one case-insensitive substring over titles, summaries, popup copy and package names.
 * @param {readonly object[]} cards the card models.
 * @param {string} query what the person typed; an empty or blank query keeps every card.
 * @returns {object[]} the cards that match, in their original order.
 */
export function filterCards(cards, query) {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : ''
  if (needle.length === 0) return cards
  return cards.filter(card => card.search.includes(needle))
}

/**
 * Build the whole tab view.
 * @param {{ catalog: readonly object[], bundles: readonly object[], text: (localized: unknown) => string }} input
 *   current Host state and resolvers.
 * @returns {{ cards: object[], counts: { total: number, installed: number, enabled: number } }} the tab model.
 */
export function buildMarketView(input) {
  const byName = new Map(input.bundles.map(bundle => [bundle.name, bundle]))
  const options = { text: input.text }
  // The curated list keeps its order; every other bundle the Host manages joins after it, so an installed plugin the
  // catalogue never named (and an official bundle offered on demand) is still visible here.
  const entries = [...input.catalog]
  const covered = new Set()
  for (const entry of entries) {
    covered.add(entry.name)
    for (const name of entry.aliases ?? []) covered.add(name)
  }
  for (const bundle of input.bundles) {
    if (covered.has(bundle.name) || HIDDEN_HOST_BUNDLES.has(bundle.name)) continue
    if (bundle.name.startsWith(THEME_PALETTE_PREFIX) && bundle.name !== '@local/ocean-theme-picker') continue
    const offered = bundle.official === true && (bundle.installTarget !== undefined || bundle.optional === true)
    // The Host also lists composition-owned layers, not just plugins managed from this page.
    const configured = (bundle.installed || bundle.enabled) && bundle.removable
    if (!configured && !(offered && bundle.listedByDefault !== false)) continue
    entries.push(entryForBundle(bundle))
    covered.add(bundle.name)
  }
  const cards = entries.map(entry => cardFor(entry, bundleFor(entry, byName), options))
  const counts = { total: cards.length, installed: 0, enabled: 0 }
  for (const card of cards) {
    if (card.installed) counts.installed += 1
    if (card.enabled) counts.enabled += 1
  }
  return { cards, counts }
}
