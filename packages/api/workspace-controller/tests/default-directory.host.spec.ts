import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { NativeCommandRunner } from '@ocean/ocean-native-command'
import { defaultWorkspaceDirectory, validateDocumentsDirectory } from '../src/default-directory.ts'

describe('system Documents directory', () => {
  it.each([
    ['darwin', '/Users/a/文档/\n', '/Users/a/文档/Ocean/default-workspace', 'osascript'],
    ['win32', 'D:\\Redirected Documents\r\n', 'D:\\Redirected Documents\\Ocean\\default-workspace', 'powershell.exe'],
    ['linux', '/home/a/My Documents\n', '/home/a/My Documents/Ocean/default-workspace', 'xdg-user-dir'],
  ] as const)('uses the %s account directory and preserves spaces and Unicode', async (platform, stdout, path, command) => {
    const run = vi.fn<NativeCommandRunner>(async () => ({ stdout, stderr: '' }))
    const signal = new AbortController().signal
    await expect(defaultWorkspaceDirectory(undefined, signal, { platform, run, directoryExists: async () => false })).resolves.toBe(path)
    expect(run).toHaveBeenCalledWith(command, expect.any(Array), signal, 'hidden')
  })

  it('uses the configured directory without a system lookup', async () => {
    const run = vi.fn<NativeCommandRunner>()
    await expect(defaultWorkspaceDirectory('/documents', new AbortController().signal, { platform: 'linux', run, directoryExists: async () => false }))
      .resolves.toBe('/documents/Ocean/default-workspace')
    expect(run).not.toHaveBeenCalled()
  })

  it.each(['', '\r\n', '/home/a\n'])('rejects an unavailable XDG directory %j', async (stdout) => {
    const run: NativeCommandRunner = async () => ({ stdout, stderr: '' })
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'linux', home: '/home/a', run }))
      .rejects.toThrow('unavailable')
  })

  it('propagates lookup failure and cancellation', async () => {
    const run: NativeCommandRunner = async () => { throw new Error('lookup denied') }
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'darwin', run }))
      .rejects.toThrow('lookup denied')
    await expect(defaultWorkspaceDirectory('/documents', AbortSignal.abort(), { platform: 'linux' }))
      .rejects.toThrow()
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'freebsd' }))
      .rejects.toThrow('unavailable')
  })

  it.each(['relative', 'C:relative', '\\rooted'])('rejects a Windows path without a fully qualified root: %s', (path) => {
    expect(() => validateDocumentsDirectory(path, 'win32')).toThrow('fully qualified')
  })

  it('accepts redirected UNC Documents directories', () => {
    expect(validateDocumentsDirectory('\\\\server\\share\\Documents', 'win32')).toBe('\\\\server\\share\\Documents')
    expect(() => validateDocumentsDirectory('relative', 'linux')).toThrow('fully qualified')
  })
})

describe('default Workspace directory compatibility', () => {
  const signal = new AbortController().signal

  it('prefers Ocean, otherwise reuses legacy data in place without creating or moving files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-default-directory-'))
    const ocean = join(root, 'Ocean', 'default-workspace')
    const legacy = join(root, 'deepseek-harness', 'default-workspace')
    try {
      expect(await defaultWorkspaceDirectory(root, signal)).toBe(ocean)
      expect(await readdir(root)).toEqual([])
      await mkdir(legacy, { recursive: true })
      await writeFile(join(legacy, 'user.txt'), 'preserved')
      expect(await defaultWorkspaceDirectory(root, signal)).toBe(legacy)
      expect(await readFile(join(legacy, 'user.txt'), 'utf8')).toBe('preserved')
      expect(await readdir(root)).toEqual(['deepseek-harness'])
      await mkdir(ocean, { recursive: true })
      expect(await defaultWorkspaceDirectory(root, signal)).toBe(ocean)
      expect(await readFile(join(legacy, 'user.txt'), 'utf8')).toBe('preserved')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['Ocean', 'deepseek-harness'])('rejects a non-directory %s candidate without overwriting it', async (brand) => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-default-collision-'))
    const candidate = join(root, brand, 'default-workspace')
    try {
      await mkdir(join(root, brand))
      await writeFile(candidate, 'preserved')
      await expect(defaultWorkspaceDirectory(root, signal)).rejects.toThrow('not a directory')
      expect(await readFile(candidate, 'utf8')).toBe('preserved')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('propagates inspection errors rather than falling back to a new directory', async () => {
    const directoryExists = vi.fn(async () => { throw new Error('permission denied') })
    await expect(defaultWorkspaceDirectory('/documents', signal, { directoryExists })).rejects.toThrow('permission denied')
    expect(directoryExists).toHaveBeenCalledTimes(1)
  })

  it('checks cancellation after asynchronous filesystem inspection', async () => {
    const controller = new AbortController()
    const directoryExists = vi.fn(async () => { controller.abort(); return false })
    await expect(defaultWorkspaceDirectory('/documents', controller.signal, { directoryExists })).rejects.toThrow()
    expect(directoryExists).toHaveBeenCalledTimes(1)
  })
})
