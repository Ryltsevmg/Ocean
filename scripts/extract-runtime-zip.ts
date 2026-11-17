/** ZIP extraction for checksum-verified build inputs in private staging directories. */
import extractZip from '@electron-internal/extract-zip'

/**
 * Extract one immutable, checksum-verified runtime archive into trusted staging.
 * @param archive - Verified Electron, Node, or library-wheel archive.
 * @param destination - Absolute directory owned exclusively by the build.
 * @returns Resolves after extraction; failures can leave partial staging output.
 */
export function extractRuntimeZip(archive: string, destination: string): Promise<void> {
  return extractZip(archive, { dir: destination })
}
