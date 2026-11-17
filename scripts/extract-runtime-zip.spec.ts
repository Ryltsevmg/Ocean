/** Runtime archive containment and retained Unix framework-link behavior. */
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { extractRuntimeZip } from './extract-runtime-zip.ts'
import { zipFixture } from './zip-test-fixture.ts'

it.each(['../outside/victim', '/outside/victim'])('rejects an escaping symlink target %s', async (target) => {
  const root = await mkdtemp(join(tmpdir(), 'ocean-zip-escape-'))
  try {
    const archive = join(root, 'runtime.zip')
    await writeFile(archive, zipFixture([{ name: 'link', content: target, mode: 0o120777 }]))
    await expect(extractRuntimeZip(archive, join(root, 'staging'))).rejects.toThrow()
    await expect(lstat(join(root, 'staging/link'))).rejects.toMatchObject({ code: 'ENOENT' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

it.each([false, true])('contains same-name symlink and regular entries (link last: %s)', async (linkLast) => {
  const root = await mkdtemp(join(tmpdir(), 'ocean-zip-duplicate-'))
  try {
    await mkdir(join(root, 'outside'))
    await writeFile(join(root, 'outside/victim'), 'original')
    const link = { name: 'victim', content: '../outside/victim', mode: 0o120777 }
    const file = { name: 'victim', content: 'replacement' }
    const archive = join(root, 'runtime.zip')
    await writeFile(archive, zipFixture(linkLast ? [file, link] : [link, file]))
    // ZIP implementations may reject duplicates or retain only the last entry.
    // Either result must preserve files outside the private staging directory.
    await extractRuntimeZip(archive, join(root, 'staging')).catch((error: unknown) => {
      expect(error).toBeInstanceOf(Error)
    })
    expect(await readFile(join(root, 'outside/victim'), 'utf8')).toBe('original')
    const extracted = await lstat(join(root, 'staging/victim')).catch((error: unknown) => {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
      return undefined
    })
    expect(extracted?.isSymbolicLink() ?? false).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }) }
})

// Creating the framework alias requires POSIX symlink semantics and mode bits.
it.skipIf(process.platform === 'win32')('preserves relative in-tree Electron framework links and executable mode', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ocean-zip-framework-'))
  try {
    const archive = join(root, 'runtime.zip')
    await writeFile(archive, zipFixture([
      { name: 'Framework/Versions/A/binary', content: 'runtime', mode: 0o100755 },
      { name: 'Framework/Versions/Current', content: 'A', mode: 0o120777 },
      { name: 'Framework/binary', content: 'Versions/Current/binary', mode: 0o120777 },
    ]))
    await extractRuntimeZip(archive, join(root, 'staging'))
    expect(await readFile(join(root, 'staging/Framework/binary'), 'utf8')).toBe('runtime')
    expect(await readlink(join(root, 'staging/Framework/Versions/Current'))).toBe('A')
    expect((await stat(join(root, 'staging/Framework/binary'))).mode & 0o777).toBe(0o755)
  } finally { await rm(root, { recursive: true, force: true }) }
})
