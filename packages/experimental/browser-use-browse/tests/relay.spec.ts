import { chmod, unlink, symlink, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { afterEach, expect, it } from 'vitest'
import { openBrowse } from '../src/relay.ts'
import { fixture, cleanupFixture } from './fixture.ts'
afterEach(cleanupFixture)
it('uses independent ids, exact allowlist and only the owned id for execution/cleanup', async () => {
  const f = await fixture()
  const a = await openBrowse(f.config, new AbortController().signal)
  const b = await openBrowse(f.config, new AbortController().signal)
  expect(f.calls.filter(c => c.path.endsWith('/new')).map(c => c.body.id)[0]).not.toBe(f.calls.filter(c => c.path.endsWith('/new')).map(c => c.body.id)[1])
  expect(await a.execute('navigate', { url: 'https://example.com' }, new AbortController().signal)).toBe('page snapshot')
  await a.close(); await b.close()
  const own = f.calls.find(c => c.path.endsWith('/new'))!.body.id
  expect(f.calls.find(c => c.path.endsWith('/execute'))!.body.sessionId).toBe(own)
  expect(f.calls.find(c => c.path.endsWith('/execute'))!.body.createIfMissing).toBe(false)
  expect(f.calls.filter(c => c.path.endsWith('/delete'))[0]!.body.id).toBe(own)
})
it('rejects incompatible relay before creating sessions', async () => {
  const f = await fixture({ version: '0.0.17' }); await expect(openBrowse(f.config, new AbortController().signal)).rejects.toThrow('version')
  expect(f.calls).toHaveLength(1)
})
it('refuses overlarge results and poisons uncertain sessions without retry', async () => {
  const f = await fixture({ oversized: true })
  const a = await openBrowse(f.config, new AbortController().signal)
  await expect(a.execute('snapshot', {}, new AbortController().signal)).rejects.toThrow()
  await expect(a.execute('snapshot', {}, new AbortController().signal)).rejects.toThrow('uncertain')
  expect(f.calls.filter(c => c.path.endsWith('/execute'))).toHaveLength(1); await a.close()
})
it('rejects a result carrying another session id', async () => {
  const f = await fixture({ wrongSession: true })
  const a = await openBrowse(f.config, new AbortController().signal)
  await expect(a.execute('snapshot', {}, new AbortController().signal)).rejects.toThrow('session')
  await a.close()
})

it('preserves warnings and challenge outcomes in the model result', async () => {
  const f = await fixture({ warnings: true })
  const a = await openBrowse(f.config, new AbortController().signal)
  const text = await a.execute('snapshot', {}, new AbortController().signal)
  expect(text).toContain('Navigation blocked'); expect(text).toContain('captcha'); await a.close()
})

it('rejects symlinks, insecure permissions, oversized files and FIFOs without network access', async () => {
  for (const mode of ['symlink', 'permissions', 'large', 'fifo']) {
    const f = await fixture()
    if (mode === 'permissions') await chmod(f.config.tokenFile, 0o644)
    if (mode === 'large') await writeFile(f.config.tokenFile, 'x'.repeat(65))
    if (mode === 'symlink') { await unlink(f.config.tokenFile); await symlink('/not-a-token', f.config.tokenFile) }
    if (mode === 'fifo') { await unlink(f.config.tokenFile); await promisify(execFile)('mkfifo', [f.config.tokenFile]) }
    await expect(openBrowse(f.config, new AbortController().signal)).rejects.toThrow('Browse request')
    expect(f.calls).toHaveLength(0)
  }
})
it('allows a human handoff beyond the ordinary action timeout', async () => {
  const f = await fixture({ delayMs: 180 }); f.config.timeoutMs = 100
  const a = await openBrowse(f.config, new AbortController().signal)
  expect(await a.execute('handoff', { message: 'Complete sign-in.' }, new AbortController().signal)).toBe('page snapshot')
  await a.close()
})
it('cancellation poisons execution and never retries the uncertain action', async () => {
  const f = await fixture({ delayMs: 180 })
  const a = await openBrowse(f.config, new AbortController().signal)
  const controller = new AbortController()
  const pending = a.execute('snapshot', {}, controller.signal)
  const timer = setTimeout(() => { controller.abort() }, 50)
  try { await expect(pending).rejects.toThrow() } finally { clearTimeout(timer) }
  await expect(a.execute('snapshot', {}, new AbortController().signal)).rejects.toThrow('uncertain')
  expect(f.calls.filter(c => c.path.endsWith('/execute'))).toHaveLength(1)
  await a.close()
})

it('retains bounded diagnostic warnings on failed actions and accepts confirmed absence on close', async () => {
  const f = await fixture({ warnings: true, actionError: true, alreadyAbsent: true })
  const a = await openBrowse(f.config, new AbortController().signal)
  await expect(a.execute('snapshot', {}, new AbortController().signal)).rejects.toThrow('Navigation blocked')
  await a.close()
})
