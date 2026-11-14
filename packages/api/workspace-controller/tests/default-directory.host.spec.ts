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

  it.each(['', '\r\n', '/home/a\n', '/home/a/\n', '/home/a//\n', '/home/a/.\n'])(
    'rejects an unavailable XDG directory %j before inspecting workspace paths', async (stdout) => {
      const run: NativeCommandRunner = async () => ({ stdout, stderr: '' })
      const directoryExists = vi.fn(async () => false)
      await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'linux', home: '/home/a', run, directoryExists }))
        .rejects.toMatchObject({ code: 'workspace/default-directory-unavailable', details: {} })
      expect(directoryExists).not.toHaveBeenCalled()
    },
  )

  it.each(['ENOENT', 1])('retains the native lookup failure %s as the typed error cause', async (code) => {
    const cause = Object.assign(new Error('lookup denied'), { code })
    const run: NativeCommandRunner = async () => { throw cause }
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'linux', run }))
      .rejects.toMatchObject({ code: 'workspace/default-directory-unavailable', details: {}, cause })
  })

  it('leaves unexpected lookup defects unchanged', async () => {
    const failure = new Error('unexpected lookup defect')
    const run: NativeCommandRunner = async () => { throw failure }
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'linux', run })).rejects.toBe(failure)
  })

  it('does not reject a Documents descendant of HOME as disabled', async () => {
    const run: NativeCommandRunner = async () => ({ stdout: '/home/a/Documents/\n', stderr: '' })
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'linux', home: '/home/a/', run, directoryExists: async () => false }))
      .resolves.toBe('/home/a/Documents/Ocean/default-workspace')
  })

  it('preserves cancellation before and during lookup', async () => {
    await expect(defaultWorkspaceDirectory('/documents', AbortSignal.abort(), { platform: 'linux' })).rejects.toThrow()
    const controller = new AbortController()
    const reason = new Error('caller cancelled')
    const run: NativeCommandRunner = async () => { controller.abort(reason); throw new Error('native abort') }
    await expect(defaultWorkspaceDirectory(undefined, controller.signal, { platform: 'linux', run })).rejects.toBe(reason)
  })

  it('preserves cancellation when native lookup settles with an unavailable directory', async () => {
    const controller = new AbortController()
    const reason = new Error('caller cancelled')
    const run: NativeCommandRunner = async () => { controller.abort(reason); return { stdout: '/home/a/', stderr: '' } }
    await expect(defaultWorkspaceDirectory(undefined, controller.signal, { platform: 'linux', home: '/home/a', run })).rejects.toBe(reason)
  })

  it('reports an unsupported system lookup as unavailable', async () => {
    await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: 'freebsd' }))
      .rejects.toMatchObject({ code: 'workspace/default-directory-unavailable' })
  })

  it.each([true, false])('accepts configured system Documents whether the directory exists (%s)', async (exists) => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-xdg-documents-'))
    const documents = join(root, 'Documents')
    try {
      if (exists) await mkdir(documents)
      const run: NativeCommandRunner = async () => ({ stdout: `${documents}\n`, stderr: '' })
      await expect(defaultWorkspaceDirectory(undefined, new AbortController().signal, { platform: process.platform, home: root, run }))
        .resolves.toBe(join(documents, 'Ocean', 'default-workspace'))
      expect(await readdir(root)).toEqual(exists ? ['Documents'] : [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
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
