/** Human-owned browser configuration mounted on the optional bundle detail page. */
import type { Context } from '@deepseek-ai/cordis'
import browseRemote from '@ocean/ocean-browser-use-browse/remote'
import type {} from '@ocean/ocean-api-remotes/client'
import type {} from '@ocean/ocean-client-locale/client'
import type {} from '@ocean/ocean-client-ui-plugin-manager/client'
import type {} from '@ocean/ocean-client-ui-renderer/client'
import { SetupController } from './controller.ts'
import { SetupPanel } from './panel.tsx'
import { NS, en, ru, zh, ja, es, fr, de, pt, type SetupLocaleKey } from './locales.ts'
declare module '@ocean/ocean-client-ui-slots' {
  interface LocaleNamespaceMap { oceanBrowserSetup: SetupLocaleKey }
}
/** Existing browser UI services. */
export const inject = ['remote', 'slots', 'locale']
/** Mount transport and UI without pairing or starting a relay. */
export async function apply(ctx: Context): Promise<() => Promise<void>> {
  // Do not mount the legacy Browse settings widget in the Desktop RC. Saved profile rows stay intact.
  if ('dshDesktop' in globalThis) return async () => {}
  const transport = ctx.plugin(async (owner) => { await owner.remote.$mount(browseRemote) })
  const ui = ctx.inject(['remote.browserSetup', 'slots', 'locale'], (ctx) => {
    ctx.effect(() => ctx.locale.register(NS, { en, ru, zh, ja, es, fr, de, pt }))
    const controller = new SetupController(ctx.remote.browserSetup)
    const face = controller.face()
    ctx.effect(() => () =>{  controller.dispose() })
    ctx.on('connection/reset', face.refresh)
    ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config', key: '@ocean/ocean-browser-use-browse', locale: NS, inject: () => face,
    }, SetupPanel))
  })
  const dispose = ctx.effect(function* () { yield transport.dispose; yield ui.dispose }, 'browse-setup.mount')
  try { await Promise.all([transport, ui]) } catch (error) { await dispose(); throw error }
  return dispose
}
