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
    const numeric = /^\d+$/u.test(one) && /^\d+$/u.test(other)
    if (numeric) return Number(one) < Number(other) ? -1 : 1
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
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/u.exec(value.trim())
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
  const installedVersion = bundle === undefined ? undefined : bundle.version
  const isSelf = entry.self === true
  const spec = typeof entry.spec === 'string' && entry.spec.length > 0 ? entry.spec : undefined

  let state
  if (isSelf) state = 'self'
  else if (bundle === undefined) state = spec === undefined ? 'unavailable' : 'missing'
  else state = bundle.enabled === true ? 'on' : 'off'

  const actions = []
  let note
  let error

  if (state === 'missing') actions.push({ kind: 'install', enabled: true })
  if (state === 'off' || state === 'on') {
    actions.push({ kind: state === 'on' ? 'disable' : 'enable', enabled: true })
    if (bundle.installed === true && bundle.removable === true) actions.push({ kind: 'remove', enabled: true })
    actions.push({ kind: 'open', enabled: true })
  }

  if (state === 'on' || state === 'off') {
    error = errorText(bundle.error)
    // The catalogue, not a registry scan, decides what an update is: the market offers only the version it curates, so
    // pressing Update can never replace a local build with whatever the registry happens to publish.
    const curatedNewer = typeof entry.version === 'string' && typeof installedVersion === 'string'
      && compareVersions(entry.version, installedVersion) > 0
    if (bundle.update === 'git') {
      note = 'noteGitUpdate'
    } else if (curatedNewer && bundle.update === 'registry') {
      actions.unshift({ kind: 'update', enabled: true, version: entry.version })
    } else if (curatedNewer) {
      // A bundle the installation itself carries follows the installation; one installed from a path, a tarball or a
      // link can only be replaced by reinstalling it from that source.
      note = bundle.availability === 'installation' ? 'noteBuildCarried' : 'noteSourceUpdate'
    }
  } else if (state === 'unavailable') {
    note = 'noteNotInBuild'
  }
  if (error !== undefined) note = 'noteError'
  if (note === undefined && bundle !== undefined && bundle.optional === true) note = 'noteShipped'

  const title = text(entry.title)
  const summary = text(entry.summary)
  return {
    id: entry.name,
    name: entry.name,
    title,
    summary,
    about,
    points,
    // One lowercased haystack per card: the search matches what the card and its popup show, and the package name.
    search: [title, summary, entry.name, about, ...points].join(' ').toLowerCase(),
    version: installedVersion ?? entry.version,
    installedVersion,
    state,
    badge: `badge${state[0].toUpperCase()}${state.slice(1)}`,
    updateKind: bundle === undefined ? undefined : bundle.update,
    spec,
    removable: bundle !== undefined && bundle.removable === true,
    optional: bundle !== undefined && bundle.optional === true,
    actions,
    note,
    error,
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
  const cards = input.catalog.map(entry => cardFor(entry, byName.get(entry.name), options))
  const counts = { total: cards.length, installed: 0, enabled: 0 }
  for (const card of cards) {
    if (card.installedVersion !== undefined) counts.installed += 1
    if (card.state === 'on') counts.enabled += 1
  }
  return { cards, counts }
}
