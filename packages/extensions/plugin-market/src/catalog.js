/** Client projection of the Host's verified publication metadata. */

/**
 * @typedef {import('@ocean/ocean-api-remotes/client').PublishedPluginTarget & {title: string}} PublishedInstallTarget
 * Exact publication the Plugins page asks the Host to install.
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
 * Select only the release identity and display name requested by the Plugins page.
 * @param {PublishedPlugin} plugin the published record.
 * @returns {PublishedInstallTarget} the install intent, with no download location.
 */
export function installTarget({ name, version, sha256, title }) {
  return { name, version, sha256, title }
}
