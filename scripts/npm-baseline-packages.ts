/** Manifest discovery for the npm baseline's vendor, harness, and application packages. */

import { globSync } from 'node:fs'

const PACKAGE_PATTERNS = [
  'vendor/*/package.json',
  'packages/*/*/package.json',
  'apps/*/package.json',
] as const

/**
 * Discover baseline manifests across the published package trees.
 * @param root - repository root to scan.
 * @returns Sorted repository-relative manifest paths with forward slashes.
 */
export function discoverNpmBaselineManifests(root: string): string[] {
  return globSync(PACKAGE_PATTERNS, { cwd: root }).map(path => path.replaceAll('\\', '/')).sort()
}
