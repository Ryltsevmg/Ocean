/** Frozen upstream fixture bytes exercise compatibility independently of Ocean-generated inputs. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createSessionFormatCatalogWithChildren } from '../src/index.ts'
import type { SessionFormatJsonObject } from '@ocean/ocean-session-format'

const root = new URL('./fixtures/upstream-e8f7b93a/', import.meta.url)
const sourceEvidence = JSON.parse(readFileSync(new URL('source-evidence.json', root), 'utf8')) as {
  files: { file: string; sha256: string }[]
}
describe('unmodified upstream session fixtures', () => {
  it.each(sourceEvidence.files)('$file retains its upstream digest and supported semantics', ({ file, sha256 }) => {
    const bytes = readFileSync(new URL(file, root))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
    const rows = bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line) as SessionFormatJsonObject)
    const header = rows.shift()!
    const decode = () => {
      const restore = createSessionFormatCatalogWithChildren([]).createRestore(header, { recovery: 'strict', validation: 'current' })
      for (const row of rows) restore.decodeRow(row)
      return restore.finish()
    }
    if (file === 'v0.jsonl' || file === 'v2.jsonl') {
      expect(decode).toThrow(/surface before first step/)
    } else {
      const artifact = decode()
      expect(artifact.header.version).toBe(4)
      expect(artifact.header.id).toBe(header.id)
      expect(artifact.events.length).toBeGreaterThan(0)
    }
    expect(readFileSync(new URL(file, root))).toEqual(bytes)
  })
})
