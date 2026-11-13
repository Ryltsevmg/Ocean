import { describe, expect, it } from 'vitest'
import { BrowserLifecycle } from '../src/lifecycle.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

describe('stable browser authority barrier', () => {
  it('validates before drain and preserves the current generation on invalid input', async () => {
    const gate = new BrowserLifecycle()
    let closed = false
    const lease = gate.attach(async () => { closed = true })
    await expect(gate.reconfigure(() => { throw new Error('invalid') }, async () => {})).rejects.toThrow('invalid')
    expect(closed).toBe(false)
    await expect(gate.run(lease, async () => 1)).resolves.toBe(1)
    await gate.dispose()
  })

  it('waits for cleanup and operations, rejects stale closures, then allows new generation', async () => {
    const gate = new BrowserLifecycle()
    const operation = deferred(), cleanup = deferred()
    const lease = gate.attach(() => cleanup.promise)
    const run = gate.run(lease, () => operation.promise)
    await Promise.resolve()
    let next = false
    const transition = gate.reconfigure(() => 'validated', async (value) => {
      expect(value).toBe('validated')
      gate.attach(async () => {})
      next = true
    })
    await Promise.resolve()
    expect(lease.signal.aborted).toBe(true)
    expect(() => gate.run(lease, async () => {})).toThrow()
    cleanup.resolve()
    await Promise.resolve()
    expect(next).toBe(false)
    operation.resolve()
    await run
    await transition
    expect(next).toBe(true)
    expect(() => gate.run(lease, async () => {})).toThrow('Stale')
    await gate.dispose()
  })

  it('retains a fail-closed latch after cleanup failure, including queued replacements', async () => {
    const gate = new BrowserLifecycle()
    gate.attach(async () => { throw new Error('uncertain cleanup') })
    let applied = false
    const first = gate.reconfigure(() => 1, async () => { applied = true })
    const queued = gate.reconfigure(() => 2, async () => { applied = true })
    await expect(first).rejects.toThrow('cleanup failed')
    await expect(queued).rejects.toThrow('cleanup failed')
    expect(applied).toBe(false)
    expect(() => gate.attach(async () => {})).toThrow('cleanup failed')
    await expect(gate.dispose()).rejects.toThrow('cleanup failed')
  })

  it('does not admit a staged generation and cleans it if persistence fails', async () => {
    const gate = new BrowserLifecycle()
    let closed = false
    await expect(gate.reconfigure(() => 1, async () => {
      const staged = gate.attach(async () => { closed = true })
      expect(() => gate.run(staged, async () => {})).toThrow()
      throw new Error('persist failed')
    })).rejects.toThrow('persist failed')
    expect(closed).toBe(true)
    expect(gate.blocked).toBe(true)
    expect(() => gate.attach(async () => {})).toThrow('cleanup failed')
    await expect(gate.dispose()).rejects.toThrow('cleanup failed')
  })

  it('release is idempotent across loader teardown and cannot close a successor', async () => {
    const gate = new BrowserLifecycle()
    let closes = 0
    const old = gate.attach(async () => { closes++ })
    await gate.reconfigure(() => 1, async () => {
      await gate.release(old)
      gate.attach(async () => { closes++ })
    })
    await gate.release(old)
    expect(closes).toBe(1)
    expect(gate.blocked).toBe(false)
    await gate.dispose()
    expect(closes).toBe(2)
  })

  it('disposal prevents admission immediately and prevents queued configuration from applying', async () => {
    const gate = new BrowserLifecycle()
    const lease = gate.attach(async () => {})
    let applied = false
    const pending = gate.reconfigure(() => 1, async () => { applied = true })
    const disposed = gate.dispose()
    expect(lease.signal.aborted).toBe(true)
    expect(() => gate.run(lease, async () => {})).toThrow('disposed')
    await expect(pending).rejects.toThrow('disposed')
    await disposed
    expect(applied).toBe(false)
  })
})
