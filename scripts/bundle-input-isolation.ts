/** Physical verification of the actual filesystem inputs supplied to a bundler. */

import { existsSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Verifies that recorded bundler inputs exist on the physical filesystem. */
export class BundleInputIsolation {
  private readonly label: string

  /**
   * @param _repository - repository root the verified inputs live under.
   * @param label - diagnostic prefix naming the bundler run.
   */
  constructor(_repository: string, label: string) {
    this.label = label
  }

  /** Compatibility hook for build watchers; verification keeps no cross-build state. */
  reset(): void {}

  /**
   * Require a recorded input to exist on the physical filesystem.
   * @param id - bundler module id, filesystem path, or filesystem URL.
   */
  assertInput(id: string): void {
    this.checkInput(id, false)
  }

  /**
   * Check declared source-map inputs; dependency tarballs may omit their upstream sources,
   * so a missing file only fails when no ancestor directory exists either.
   * @param id - source-map source resolved relative to its map.
   */
  assertSourceMapInput(id: string): void {
    this.checkInput(id, true)
  }

  private checkInput(id: string, allowMissing: boolean): void {
    const file = physicalBundleInput(id)
    if (file === undefined || existsSync(file)) return
    if (!allowMissing) throw new Error(`${this.label}: input ${id} is missing`)
    for (let existing = dirname(file); ; existing = dirname(existing)) {
      if (existsSync(existing)) return
      const parent = dirname(existing)
      if (parent === existing) throw new Error(`${this.label}: input ${id} has no existing filesystem root`)
    }
  }
}

/**
 * Recover the physical path from queries, filesystem URLs, and virtual path wrappers.
 * @param id - bundler module id or recorded filesystem input.
 * @returns absolute file path, or undefined for a virtual id without a physical path.
 */
export function physicalBundleInput(id: string): string | undefined {
  let clean = id.replaceAll('\\', '/').split(/[?#]/, 1)[0] ?? ''
  clean = clean.replace(/^\u0000/, '')
  if (clean.startsWith('file://')) return fileURLToPath(clean)
  if (clean.startsWith('/@fs/')) {
    clean = clean.slice('/@fs/'.length)
    if (!isAbsolute(clean) && !/^[a-zA-Z]:\//.test(clean)) clean = `/${clean}`
  }
  if (!isAbsolute(clean) && !/^[a-zA-Z]:\//.test(clean)) {
    const wrapped = /:(\/.*|[a-zA-Z]:\/.*)$/.exec(clean)?.[1]
    if (wrapped === undefined) return undefined
    clean = wrapped
  }
  return resolve(clean)
}
