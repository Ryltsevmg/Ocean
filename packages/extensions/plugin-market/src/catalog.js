/** Client projection of the Host's verified publication metadata. */

/**
 * @typedef {import('@ocean/ocean-api-remotes/client').PublishedPluginTarget & {title: string}} PublishedInstallTarget
 * Exact publication the Plugins page asks the Host to install, with the title resolved to the active UI language.
 */

/** @typedef {import('@ocean/ocean-api-remotes/client').PublishedPluginOffer} PublishedPlugin */

/**
 * Read the status of the catalogue response; individual releases are verified by the Host.
 * @param {unknown} value the unwrapped Remote response.
 * @returns {{status: 'ready' | 'stale', plugins: readonly PublishedPlugin[]} | {status: 'unavailable'}} the displayable list or its absence.
 */
export function readPublishedCatalog(value) {
  if (value !== null && typeof value === 'object' && 'status' in value && 'plugins' in value
    && (value.status === 'ready' || value.status === 'stale') && Array.isArray(value.plugins)) {
    return { status: value.status, plugins: value.plugins }
  }
  return { status: 'unavailable' }
}

/**
 * Select only the release identity and the display title resolved to the active UI language.
 * @param {PublishedPlugin} plugin the published record.
 * @param {(text: PublishedPlugin['title']) => string} resolveText resolves offer text through the active locale's fallback chain.
 * @returns {PublishedInstallTarget} the install intent, with no download location.
 */
export function installTarget(plugin, resolveText) {
  const { name, version, sha256 } = plugin
  return { name, version, sha256, title: resolveText(plugin.title) }
}
