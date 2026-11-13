/** Linux-only offline diagnostic export of legacy JSONL bytes; never a migrated or replayable conversation. */
import { constants } from 'node:fs'
import { open, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const MAX_BYTES = 16 * 1024 * 1024
/** Inspect a bounded, uncompressed legacy log without interpreting or modifying its chronology.
 * @param input - Explicit source JSONL file; symbolic links are rejected.
 * @param output - New private JSON diagnostic file; existing files are never overwritten.
 * @returns Source version and physical row count, without message content or credentials.
 */
export async function exportLegacySession(input: string, output: string): Promise<{ version: number; rows: number }> {
  if (process.platform !== 'linux') throw new Error('Legacy diagnostic export currently supports Linux only')
  const source = await open(input, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  let bytes: Buffer
  try {
    const before = await source.stat({ bigint: true })
    if (!before.isFile() || before.size === 0n || before.size > BigInt(MAX_BYTES)) throw new Error('Expected a nonempty regular JSONL file no larger than 16 MiB')
    bytes = Buffer.alloc(Number(before.size))
    let offset = 0
    while (offset < bytes.length) {
      const read = await source.read(bytes, offset, bytes.length - offset, offset)
      if (read.bytesRead === 0) throw new Error('Source changed while reading')
      offset += read.bytesRead
    }
    const after = await source.stat({ bigint: true })
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new Error('Source changed while reading')
  } finally { await source.close() }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const lines = text.split('\n')
  if (lines.at(-1) === '') lines.pop()
  const physicalRows: Record<string, unknown>[] = []
  for (const [index, line] of lines.entries()) {
    let row: unknown
    try { row = JSON.parse(line) } catch { throw new Error(`Invalid JSON at physical line ${index + 1}; no export written`) }
    if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new Error(`Non-object physical line ${index + 1}; no export written`)
    physicalRows.push(row as Record<string, unknown>)
  }
  const header = physicalRows[0]
  if (header === undefined) throw new Error('Missing legacy session header')
  const version = header['version']
  if (header['type'] !== 'session' || !Number.isInteger(version) || typeof version !== 'number' || version < 0 || version > 3) {
    throw new Error('Only uncompressed legacy session JSONL versions 0 through 3 are supported')
  }
  const diagnostic = {
    kind: 'ocean-legacy-physical-log-export', exportVersion: 1,
    warning: 'Parsed JSON rows, NOT a migrated, restored, or replayable conversation or a byte-preserving archive. Duplicate object keys and numeric precision follow JSON.parse semantics; retain the original file. No chronology, projections, child histories, or attachments are reconstructed. May contain secrets and personal data; review before sharing.',
    sourceFormatVersion: version, sourceBytes: bytes.length,
    sourceSha256: createHash('sha256').update(bytes).digest('hex'), physicalRows,
  }
  await writeFile(output, JSON.stringify(diagnostic, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  return { version, rows: physicalRows.length }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, ...extra] = process.argv.slice(2)
  if (input === undefined || output === undefined || extra.length !== 0) {
    console.error('Usage: tsx scripts/export-legacy-session.ts INPUT.jsonl NEW-PRIVATE-OUTPUT.json')
    process.exitCode = 1
  } else {
    try {
      const result = await exportLegacySession(input, output)
      console.log(`Private diagnostic export written: legacy v${result.version}, ${result.rows} physical rows. Not a restored conversation; review before sharing.`)
    } catch {
      console.error('Legacy export failed. Original file was not modified; no existing output was overwritten. Check format, size, paths and access permissions.')
      process.exitCode = 1
    }
  }
}
