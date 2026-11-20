/** Reads never return the harness credential store, in any sandbox mode. */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SandboxPolicyService from '@ocean/ocean-sandbox-policy'
import SessionProjectionRegistry from '@ocean/ocean-session-projection'
import { SandboxedFileSystem } from '@ocean/ocean-fs-sandbox'

let base: string
let home: string
let workspace: string
let previous: string | undefined
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>
let fs: SandboxedFileSystem

beforeEach(async () => {
  previous = process.env['OCEAN_HOME']
  base = await mkdtemp(join(tmpdir(), 'ocean-fs-reads-'))
  home = join(base, 'home')
  workspace = join(base, 'workspace')
  await mkdir(home, { recursive: true })
  await mkdir(workspace, { recursive: true })
  process.env['OCEAN_HOME'] = home
  ctx = new Context()
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: workspace })
  fiber = await ctx.plugin(SandboxedFileSystem, { cwd: workspace })
  fs = ctx.fs as SandboxedFileSystem
})

afterEach(async () => {
  await fiber.dispose()
  await ctx.fiber.dispose()
  if (previous === undefined) delete process.env['OCEAN_HOME']
  else process.env['OCEAN_HOME'] = previous
  await rm(base, { recursive: true, force: true })
})

describe('credential store reads', () => {
  it('denies text, byte, and window reads of the harness credential store', async () => {
    const credentials = join(home, '.credentials.yaml')
    await writeFile(credentials, 'deepseek: sk-test\n')
    const target = await fs.resolve(credentials)
    await expect(fs.readText(target)).rejects.toThrow(expect.objectContaining({ code: 'FS_SANDBOX_DENIED' }))
    await expect(fs.readBytes(target, undefined, 1024)).rejects.toThrow(expect.objectContaining({ code: 'FS_SANDBOX_DENIED' }))
    await expect(fs.readByteRange(target, { offset: 0, length: 4 })).rejects.toThrow(expect.objectContaining({ code: 'FS_SANDBOX_DENIED' }))
  })

  it('still reads other files under the harness home', async () => {
    const notes = join(home, 'notes.txt')
    await writeFile(notes, 'ok')
    expect(await fs.readText(await fs.resolve(notes))).toBe('ok')
  })
})
