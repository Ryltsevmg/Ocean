/** The Linux helper stays owned by one Agent and never retries uncertain actions. */
import { PassThrough } from 'node:stream'
import { expect, it, vi } from 'vitest'
import { createLinuxChannel } from '../src/channel.ts'
import type { NativeClientConfig } from '@ocean/ocean-cua/native-client'
import type { SubprocessRuntime } from '@ocean/ocean-subprocess'

const config: NativeClientConfig = { helperPath: '/test/helper.py', cwd: '/', timeoutMs: 1000, connectTimeoutMs: 1000,
  screenshotTimeoutMs: 1000, axTimeoutMs: 1000, maxRequestBytes: 1024, maxResponseBytes: 4096,
  graceMs: 100, textEventIntervalMs: 0, maxClickHoldMs: 0 }
function fixture(sessionId?: string) {
  const done = Promise.withResolvers<{ exitCode: number | null; signal: NodeJS.Signals | null }>()
  const stdin = new PassThrough(), stdout = new PassThrough()
  const terminate = vi.fn(() => { done.resolve({ exitCode: null, signal: 'SIGTERM' }) })
  const spawn = vi.fn((_spec: Parameters<SubprocessRuntime['spawn']>[0]) => ({ stdin, stdout, done: done.promise, terminate, waitForExit: async () => true }))
  const channel = createLinuxChannel('/usr/bin/python', sessionId)({ subprocess: { spawn } as unknown as Pick<SubprocessRuntime, 'spawn'> }, config)
  return { channel, spawn, terminate, done, stdin }
}
it('launches isolated system Python without a shell and bounds native output', async () => {
  const f = fixture()
  expect(f.spawn.mock.calls[0]?.[0]).toMatchObject({ argv: ['/usr/bin/python', '-I', '/test/helper.py', '--max-request-bytes', '1024', '--max-response-bytes', '4096'], cwd: '/' })
  f.done.resolve({ exitCode: 0, signal: null })
  await f.channel.waitForClose()
})
it('cancellation terminates the connection rather than claiming an action was undone', async () => {
  const f = fixture()
  f.channel.stdin.write('{"type":"cancel","id":"pending"}\n')
  await expect(f.channel.done).rejects.toThrow('NATIVE_EXITED')
  expect(f.terminate).toHaveBeenCalledTimes(1)
})
it('close joins process termination and is idempotent', async () => {
  const f = fixture()
  f.channel.close(); f.channel.close()
  await f.channel.waitForClose()
  expect(f.terminate).toHaveBeenCalledTimes(1)
})

it('passes only an explicitly configured logind session binding', async () => {
  const f = fixture('c2')
  expect(f.spawn.mock.calls[0]?.[0].argv.slice(-2)).toEqual(['--session-id', 'c2'])
  f.done.resolve({ exitCode: 0, signal: null })
  await f.channel.waitForClose()
})
