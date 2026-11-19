/** Own the latest catalogue and inventory reads independently of the mounted tab. */
import { readPublishedCatalog } from './catalog.js'
import { buildMarketView } from './view.js'

/** @typedef {import('./catalog.js').PublishedInstallTarget} PublishedInstallTarget */
/** @typedef {import('@ocean/ocean-api-remotes/client').BundleInfo} BundleInfo */
/** @typedef {import('@ocean/ocean-api-remotes/client').ChangeResult} ChangeResult */
/** @typedef {'loading' | 'ready' | 'stale' | 'unavailable'} CatalogStatus */
/** @typedef {'loading' | 'ready' | 'unavailable'} InventoryStatus */
/** @typedef {{title: Exclude<ChangeResult['application'], 'applied'> | 'transportError', diagnostic?: string}} ChangeNotice */

/**
 * Create a controller scoped to one plugin application. A failed read retains its last usable data, but only current
 * publication and inventory data can offer a new install.
 * @param {{listPublishedCatalog: () => Promise<unknown>, listBundles: () => Promise<BundleInfo[]>,
 *   setBundleEnabled: (name: string, enabled: boolean) => Promise<ChangeResult>}} api the Host's plugin manager.
 * @returns The catalogue state source and tab actions.
 */
export function createMarketController(api) {
  /** @type {Set<() => void>} */
  const listeners = new Set()
  /** @type {readonly import('./catalog.js').PublishedPlugin[] | undefined} */
  let plugins
  /** @type {BundleInfo[]} */
  let bundles = []
  let disposed = false
  let catalogRequest = 0
  let inventoryRequest = 0
  let snapshot = Object.freeze({
    status: /** @type {CatalogStatus} */ ('loading'),
    inventory: /** @type {InventoryStatus} */ ('loading'),
    hasCatalog: false,
    ...buildMarketView({ plugins: [], bundles, fresh: false, inventoryReady: false }),
    busy: /** @type {{name: string} | undefined} */ (undefined),
    notice: /** @type {ChangeNotice | undefined} */ (undefined),
  })

  /** @param {Partial<typeof snapshot>} patch changes to publish in the same snapshot as the projected cards. */
  function publish(patch) {
    const next = { ...snapshot, ...patch }
    const view = buildMarketView({
      plugins: plugins ?? [], bundles, fresh: next.status === 'ready', inventoryReady: next.inventory === 'ready',
    })
    snapshot = Object.freeze({ ...next, ...view, hasCatalog: plugins !== undefined })
    for (const listener of listeners) listener()
  }

  async function readCatalog() {
    const token = ++catalogRequest
    publish({ status: 'loading' })
    const result = await api.listPublishedCatalog().then(readPublishedCatalog, () => ({ status: /** @type {const} */ ('unavailable') }))
    if (disposed || token !== catalogRequest) return
    if (result.status !== 'unavailable') plugins = result.plugins
    publish({ status: result.status })
  }

  async function readInventory() {
    const token = ++inventoryRequest
    publish({ inventory: 'loading' })
    const result = await api.listBundles().then(value => Array.isArray(value) ? value : undefined, () => undefined)
    if (disposed || token !== inventoryRequest) return
    if (result !== undefined) bundles = result
    publish({ inventory: result === undefined ? 'unavailable' : 'ready' })
  }

  async function load() {
    if (disposed) return
    await Promise.all([readCatalog(), readInventory()])
  }

  return {
    /** @param {() => void} listener observes each new snapshot. @returns {() => void} unsubscribe. */
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    /** @returns {typeof snapshot} the current catalogue and inventory presentation state. */
    getSnapshot() {
      return snapshot
    },
    /** Read publication and inventory together, without coupling their results. */
    load,
    /** Refresh only after the catalogue was opened at least once. */
    invalidate() {
      if (catalogRequest > 0) return load()
    },
    /**
     * Recheck an install gesture against the latest card before opening the Plugins page's installation dialog.
     * @param {PublishedInstallTarget} target the release displayed when the install handler was rendered.
     * @returns {PublishedInstallTarget | undefined} the current target, only if the release still matches and is installable.
     */
    getInstallTarget(target) {
      if (disposed || snapshot.busy !== undefined) return undefined
      const action = snapshot.cards.find(card => card.name === target.name)?.actions.find(action => action.kind === 'install')
      return action?.kind === 'install' && action.target.version === target.version && action.target.sha256 === target.sha256
        ? action.target : undefined
    },
    /** @param {string} name package name. @param {boolean} enabled target selection for a managed local copy. */
    async setEnabled(name, enabled) {
      if (disposed || snapshot.busy !== undefined || snapshot.inventory !== 'ready') return
      const allowed = snapshot.cards.find(card => card.name === name)?.actions.some(action => action.kind === (enabled ? 'enable' : 'disable'))
      if (!allowed) return
      publish({ busy: { name }, notice: undefined })
      /** @type {ChangeNotice | undefined} */
      let notice
      try {
        const result = await api.setBundleEnabled(name, enabled)
        if (result.application !== 'applied') notice = { title: result.application, diagnostic: result.error?.code }
      } catch (error) {
        // A lost response does not establish whether the Host applied the change.
        notice = { title: 'transportError', diagnostic: typeof error?.code === 'string' ? error.code : undefined }
      }
      if (disposed) return
      await readInventory()
      if (!disposed) publish({ busy: undefined, notice })
    },
    /** Stop publishing; in-flight answers cannot update a disposed controller. */
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
