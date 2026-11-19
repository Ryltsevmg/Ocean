/**
 * Installation-owned bundle lists and the plugin manager's protected and presented packages, kept apart from the code that applies them.
 * @module @ocean/ocean-official-bundles
 */

import type { OceanBundleManifest, PluginLocalizedMeta } from '@ocean/ocean-package-manifest'

export {
  DEFAULT_PROFILE_BUNDLES, INSTALLATION_OWNED_PROFILE_TUPLES, ON_DEMAND_BUNDLES, OPTIONAL_BUNDLES, PROFILE_TEMPLATES,
  RETIRED_BUNDLES, REUSED_BUNDLE_VERSIONS, canSelectBundleVersion, type ProfileTemplate,
} from './bundles.ts'
export { EXTENSION_BUNDLES, HIDDEN_BUNDLES, MORE_BUNDLES, PROTECTED_PLUGINS } from './plugin-manager.ts'

/** Offline discovery metadata; installation state and the requested version belong to the running host. */
export interface OfficialBundleCatalogEntry {
  /** Exact npm package name accepted by the existing bundle installer. */
  readonly packageName: string
  /** Package-owned Host platform declaration, available before installation. */
  readonly platforms?: OceanBundleManifest['platforms']
  /** Package-owned localized text and a self-contained icon, embedded without provider code. */
  readonly meta: Required<Pick<PluginLocalizedMeta, 'title' | 'description' | 'icon'>>
}

export { OFFICIAL_ON_DEMAND_CATALOG } from './catalog.generated.ts'
