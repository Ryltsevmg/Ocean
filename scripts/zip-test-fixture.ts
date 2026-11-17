/** Ordered ZIP entries for extraction tests, including repeated names and Unix symlinks. */
import { Zip, ZipPassThrough } from 'fflate'

/** One stored ZIP entry with optional Unix mode bits. */
interface ZipFixtureEntry {
  readonly name: string
  readonly content: string
  readonly mode?: number
}

/**
 * Encode ordered entries without deduplicating their names.
 * @param entries - Regular files or Unix symlinks; symlink content is its target.
 * @returns Complete ZIP bytes with central-directory mode metadata.
 */
export function zipFixture(entries: readonly ZipFixtureEntry[]): Uint8Array {
  const chunks: Uint8Array[] = []
  const zip = new Zip((error, chunk) => {
    if (error) throw error
    chunks.push(chunk)
  })
  for (const entry of entries) {
    const file = new ZipPassThrough(entry.name)
    file.os = 3
    file.attrs = ((entry.mode ?? 0o100644) << 16) >>> 0
    zip.add(file)
    file.push(new TextEncoder().encode(entry.content), true)
  }
  zip.end()
  return Buffer.concat(chunks)
}
