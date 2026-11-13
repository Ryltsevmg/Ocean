import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { exportLegacySession } from './export-legacy-session.ts'

async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'ocean-legacy-export-'))
  onTestFinished(() => rm(path, { recursive: true, force: true }))
  return path
}
describe.skipIf(process.platform !== 'linux')('read-only legacy diagnostic export', () => {
  it.each([0, 2])('exports unchanged upstream v%i physical rows without claiming restoration', async (version) => {
    const input = new URL(`../packages/session/session-format-catalog/tests/fixtures/upstream-e8f7b93a/v${version}.jsonl`, import.meta.url)
    const bytes = await readFile(input)
    const before = await stat(input, { bigint: true })
    const output = join(await directory(), 'diagnostic.json')
    const result = await exportLegacySession(input.pathname, output)
    const document = JSON.parse(await readFile(output, 'utf8')) as { warning: string; sourceSha256: string; physicalRows: unknown[] }
    expect(result.version).toBe(version)
    expect(document.warning).toContain('NOT a migrated')
    expect(document.sourceSha256).toBe(createHash('sha256').update(bytes).digest('hex'))
    expect(document.physicalRows).toEqual(bytes.toString().trim().split('\n').map(line => JSON.parse(line) as unknown))
    expect(await readFile(input)).toEqual(bytes)
    const after = await stat(input, { bigint: true })
    expect([after.ino, after.size, after.mtimeNs, after.ctimeNs]).toEqual([before.ino, before.size, before.mtimeNs, before.ctimeNs])
    if (process.platform !== 'win32') expect((await stat(output)).mode & 0o777).toBe(0o600)
  })
  it('never overwrites the source or an existing destination', async () => {
    const root = await directory(), input = join(root, 'input.jsonl'), output = join(root, 'existing.json')
    const source = '{"type":"session","version":0}\n'
    await writeFile(input, source); await writeFile(output, 'keep')
    await expect(exportLegacySession(input, input)).rejects.toMatchObject({ code: 'EEXIST' })
    await expect(exportLegacySession(input, output)).rejects.toMatchObject({ code: 'EEXIST' })
    expect(await readFile(input, 'utf8')).toBe(source)
    expect(await readFile(output, 'utf8')).toBe('keep')
  })
  it.each(['{"type":"session","version":4}\n', '{"type":"session","version":0}\nnot-json', '', 'null\n'])('refuses unsupported or malformed input without publishing output', async (text) => {
    const root = await directory(), input = join(root, 'input'), output = join(root, 'output')
    await writeFile(input, text)
    await expect(exportLegacySession(input, output)).rejects.toThrow()
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(input, 'utf8')).toBe(text)
  })
  it('rejects FIFO sources without waiting for a writer', async () => {
    const root = await directory(), fifo = join(root, 'fifo'), output = join(root, 'output')
    execFileSync('mkfifo', [fifo])
    await expect(exportLegacySession(fifo, output)).rejects.toThrow('regular JSONL file')
    await expect(stat(output)).rejects.toMatchObject({ code: 'ENOENT' })
  })
  it.skipIf(process.platform === 'win32')('refuses symlink sources', async () => {
    const root = await directory(), input = join(root, 'input'), link = join(root, 'link')
    await writeFile(input, '{"type":"session","version":0}\n'); await symlink(input, link)
    await expect(exportLegacySession(link, join(root, 'output'))).rejects.toThrow()
  })
})
