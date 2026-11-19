import { CATALOG } from './catalog.js'
import { createMarketController } from './controller.js'
import { buildMarketView } from './view.js'
import { en, ru, zh } from './locales.js'
import { createMarketTab } from './ui.js'

/**
 * Browser entry: registers the market's dictionaries and contributes the
 * «Каталог» tab to the Plugins page. The Host API is read lazily on each
 * call, so a Host without the `pluginManager` Remote shows a readable error in
 * the tab instead of never applying.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'pluginMarket'

/**
 * Unwrap one Remote answer. The Client Remote returns `{ ok: true, value }` or `{ ok: false, error }`; a refusal becomes
 * a thrown error carrying its stable code, so the tab reports the Host's own words instead of a shape mismatch.
 * @param {Promise<object>} answer the Remote call's promise.
 * @returns {Promise<unknown>} the unwrapped value.
 * @throws {Error} when the Host refuses the call.
 */
export async function remoteValue(answer) {
  const result = await answer
  if (result === null || typeof result !== 'object' || typeof result.ok !== 'boolean') {
    throw new Error('The pluginManager Remote answered without a result envelope')
  }
  if (result.ok === true) return result.value
  const failure = result.error ?? {}
  const error = new Error(`${failure.code ?? 'remote-error'}: ${failure.message ?? 'the Host refused the call'}`)
  error.code = failure.code
  throw error
}

/**
 * Wrap the client's `pluginManager` Remote behind the controller's small API.
 * @param {object} ctx browser plugin context.
 * @returns {object} API the controller calls, each method resolving to a plain value.
 */
export function remoteApi(ctx) {
  const manager = () => {
    const remote = ctx.remote
    if (remote === undefined || remote.pluginManager === undefined) {
      throw new Error('The pluginManager Remote is not available in this composition')
    }
    return remote.pluginManager
  }
  return {
    listBundles: async () => remoteValue(manager().listBundles()),
    setBundleEnabled: (name, enabled) => remoteValue(manager().setBundleEnabled(name, enabled)),
    removeBundle: name => remoteValue(manager().removeBundle(name)),
    updateBundle: async (name, version) => (await remoteValue(manager().updateBundle(name, version))).result,
  }
}

/**
 * Build the browser plugin.
 * @param {object} React the module loader's React.
 * @param {Function} Modal the shared client modal.
 * @param {string} [dialogClass] the built catalogue's scrollable details styling.
 * @returns {{ inject: string[], apply: (ctx: object) => void }} the Cordis client plugin.
 */
export function createMarket(React, Modal, dialogClass) {
  const { MarketTab } = createMarketTab(React, Modal, dialogClass)
  return {
    // `remote.pluginManager` is a scoped service: Cordis refuses to read it unless the plugin declares it, and the
    // declaration also keeps the tab from applying before the Remote face exists.
    inject: ['slots', 'locale', 'remote', 'remote.pluginManager'],
    apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'plugin-market: dictionaries')
      const market = createMarketController({
        api: remoteApi(ctx),
        catalog: CATALOG,
        buildView: buildMarketView,
        text: localized => ctx.locale.resolveText(localized),
      })
      ctx.effect(() => () => { market.dispose() }, 'plugin-market: controller')
      ctx.effect(() => {
        const disposers = [
          ctx.remote.$on('plugin-manager/changed', () => { market.invalidate() }),
          ctx.on('connection/reset', () => { market.invalidate() }),
          ctx.locale.subscribe(() => { market.relocalize() }),
        ]
        return () => { for (const dispose of disposers) dispose() }
      }, 'plugin-market: host invalidations')
      const t = ctx.locale.bind(NS)
      const source = { subscribe: market.subscribe, getSnapshot: market.getSnapshot }
      const actions = { load: market.load, setEnabled: market.setEnabled, remove: market.remove, update: market.update }
      ctx.slots.inject('plugins.tab', () => ctx.slots.register({
        name: 'plugins.tab',
        id: 'our-plugins',
        order: -10,
        label: () => t('tab'),
        locale: NS,
        inject: () => ({ hooks: { market: source }, actions }),
      }, MarketTab))
    },
  }
}
