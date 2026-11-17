/** Filesystem ownership for the Electron-managed desktop installation. */

import { join } from 'node:path'
import { resolveOceanHome } from '@ocean/ocean-home-paths'

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the shared data roots.
 * @param oceanHome - Harness home shared with npm-installed ocean.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(oceanHome: string = resolveOceanHome()): DesktopPaths {
  return {
    profile: join(oceanHome, 'profiles', 'desktop'),
    lock: join(oceanHome, 'profiles', 'desktop', 'lock'),
  }
}
