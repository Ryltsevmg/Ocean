/**
 * Host loader row for the plugin market. The browser half in `./client` draws
 * the «Каталог» tab and performs every management action through the
 * `pluginManager` Remote; no Host state lives here, so the row is an empty
 * `apply` that exists only for the client module system.
 */

/** Cordis plugin identity, matching the bundle row id. */
export const name = 'ocean-plugin-market'

/** Mount the row; the market contributes nothing to the Host side. */
export function apply(): void {}
