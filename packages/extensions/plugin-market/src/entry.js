/** Register the published catalogue tab and its Host invalidation listeners. */
import { createMarketController } from './controller.js'
import { en, ru, zh } from './locales.js'
import { createMarketTab } from './ui.js'

/** Dictionary namespace owned by this plugin. */
export const NS = 'pluginMarket'

/**
 * Unwrap an answer from the Host. Preserve only a refusal's stable diagnostic code for display by the controller.
 * @template T
 * @param {Promise<{ok: true, value: T} | {ok: false, error: {code?: string}}>} answer the Remote call's result.
 * @returns {Promise<T>} the unwrapped value.
 * @throws {Error} when the Host refuses the call or the envelope is invalid.
 */
export async function remoteValue(answer) {
  const result = await answer
  if (result === null || typeof result !== 'object' || typeof result.ok !== 'boolean') {
    throw new Error('The pluginManager Remote answered without a result envelope')
  }
  if (result.ok === true) return result.value
  throw Object.assign(new Error('The pluginManager Remote refused the call'), { code: result.error?.code })
}

/**
 * Wrap the client's plugin manager in the calls used by the catalogue controller.
 * @param {import('@deepseek-ai/cordis').Context} ctx browser plugin context.
 * @returns The Remote calls, with their results unwrapped.
 */
export function remoteApi(ctx) {
  return {
    listPublishedCatalog: async () => remoteValue(ctx.remote.pluginManager.listPublishedCatalog()),
    listBundles: async () => remoteValue(ctx.remote.pluginManager.listBundles()),
    setBundleEnabled: async (name, enabled) => remoteValue(ctx.remote.pluginManager.setBundleEnabled(name, enabled)),
  }
}

/**
 * Build the browser plugin from the shared React and primitive implementations.
 * @param {typeof import('react')} React the module loader's React.
 * @param {typeof import('@ocean/ocean-client-ui-primitives')} primitives the shared client primitives: the modal, the
 * Markdown renderer, and the default plugin artwork.
 * @param {string} [dialogClass] the scrollable details styling; absent uses the shared modal alone.
 * @returns {{ inject: string[], apply: (ctx: import('@deepseek-ai/cordis').Context) => void }} the Cordis client plugin.
 */
export function createMarket(React, primitives, dialogClass) {
  const { MarketTab } = createMarketTab(React, primitives, dialogClass)
  return {
    inject: ['slots', 'locale', 'remote', 'remote.pluginManager'],
    apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, ru, zh }), 'plugin-market: dictionaries')
      const resolveText = ctx.locale.resolveText.bind(ctx.locale)
      const market = createMarketController(remoteApi(ctx), resolveText)
      ctx.effect(() => market.dispose, 'plugin-market: controller')
      ctx.effect(() => ctx.locale.subscribe(() => market.republish()), 'plugin-market: locale')
      ctx.effect(() => {
        const stopChanged = ctx.remote.$on('plugin-manager/changed', () => { void market.invalidate() })
        const stopReset = ctx.on('connection/reset', () => { void market.invalidate() })
        return () => { stopChanged(); stopReset() }
      }, 'plugin-market: host invalidations')
      const t = ctx.locale.bind(NS)
      const source = { subscribe: market.subscribe, getSnapshot: market.getSnapshot }
      const actions = { load: market.load, setEnabled: market.setEnabled, getInstallTarget: market.getInstallTarget }
      ctx.slots.inject('plugins.tab', () => ctx.slots.register({
        name: 'plugins.tab',
        id: 'our-plugins',
        // Installed leads and opens by default; the published catalogue follows it.
        order: 10,
        label: () => t('tab'),
        locale: NS,
        inject: () => ({ hooks: { market: source }, actions }),
      }, MarketTab))
    },
  }
}
