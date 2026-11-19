/**
 * Market controller: owns the tab snapshot and performs every management
 * action through the injected Host API. React-free, so the browser bundle can
 * inline it and `tests/` can exercise its rules without a DOM.
 */

/** Rejection text for a snapshot, including a non-Error rejection. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @param {{ api: { listBundles: () => Promise<object[]>,
 *   setBundleEnabled: (name: string, enabled: boolean) => Promise<unknown>,
 *   removeBundle: (name: string) => Promise<unknown>,
 *   updateBundle: (name: string, version: string) => Promise<unknown> },
 *   catalog: readonly object[], text: (localized: unknown) => string,
 *   buildView: (input: object) => object }} options
 *   `api` is the Host's `pluginManager` Remote; `text` resolves the catalogue's localized strings; `buildView` is the
 *   pure projection from `src/view.js`, passed in so this module stays import-free for the inline bundle.
 * @returns {object} the tab controller.
 */
export function createMarketController(options) {
  const { api, catalog, text, buildView } = options
  const listeners = new Set()
  let bundles
  let disposed = false
  let loadToken = 0
  let snapshot = Object.freeze({
    status: 'loading',
    cards: [],
    counts: { total: catalog.length, installed: 0, enabled: 0 },
    error: undefined,
    busy: undefined,
    notice: undefined,
  })

  function emit() {
    for (const listener of listeners) listener()
  }

  function publish(patch) {
    snapshot = Object.freeze({ ...snapshot, ...patch })
    emit()
  }

  /** Rebuild the cards from the last Host list. */
  function rebuild(overrides) {
    const view = buildView({ catalog, bundles, text })
    publish({ cards: view.cards, counts: view.counts, ...overrides })
  }

  async function load() {
    const token = loadToken + 1
    loadToken = token
    try {
      const listed = await api.listBundles()
      if (disposed || token !== loadToken) return
      bundles = listed
      rebuild({ status: 'ready', error: undefined })
    } catch (error) {
      if (disposed || token !== loadToken) return
      publish({ status: snapshot.cards.length > 0 ? 'ready' : 'error', error: messageOf(error) })
    }
  }

  async function perform(name, kind, work) {
    if (disposed || snapshot.busy !== undefined) return
    publish({ busy: { name, kind }, notice: undefined })
    let notice
    try {
      const result = await work()
      if (result.application !== 'applied') {
        notice = { title: result.application, diagnostic: result.error?.diagnostic ?? result.error?.code }
      }
    } catch (error) {
      notice = { title: 'transportError', diagnostic: messageOf(error) }
    }
    if (disposed) return
    await load()
    if (disposed) return
    publish({ busy: undefined, notice })
  }

  return {
    /** @param {() => void} listener @returns {() => void} unsubscribe */
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    /** @returns {object} the current immutable snapshot. */
    getSnapshot() {
      return snapshot
    },
    /** Read the Host's bundle list and republish the cards. */
    load,
    /** Refresh an already opened catalog; unopened catalogs issue no Host requests. */
    invalidate() {
      if (!disposed && loadToken > 0) void load()
    },
    /** @param {string} name bundle package name @param {boolean} enabled target selection */
    setEnabled(name, enabled) {
      return perform(name, enabled ? 'enable' : 'disable', () => api.setBundleEnabled(name, enabled))
    },
    /** @param {string} name bundle package name */
    remove(name) {
      return perform(name, 'remove', () => api.removeBundle(name))
    },
    /**
     * Update one installed bundle to the version this catalogue curates.
     * @param {string} name bundle package name
     * @param {string} version target version, from the catalogue entry
     */
    update(name, version) {
      return perform(name, 'update', () => api.updateBundle(name, version))
    },
    /** Rebuild the cards after a language switch, without asking the Host. */
    relocalize() {
      if (disposed || bundles === undefined) return
      rebuild({})
    },
    /** Stop publishing; later Host answers are dropped. */
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
