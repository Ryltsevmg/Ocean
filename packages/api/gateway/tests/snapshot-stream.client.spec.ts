import { describe, expect, it, vi } from 'vitest'
import { RemoteError } from '@ocean/ocean-typert-protocol'
import type { ConnectionHandle } from '@ocean/ocean-client-connection/client'
import {
  RemoteSnapshotStream,
  RemoteStream,
  RemoteStreamCarrierError,
} from '../src/client/index.ts'

const GENERATION = { id: 1, host: { home: '/home/fixture' } }

interface Snapshot {
  readonly snapshot: number
}

interface Delta {
  readonly delta: number
}

const snap = (value: number): Snapshot => ({ snapshot: value })
const delta = (value: number): Delta => ({ delta: value })

/** Host availability source whose publications drive the retry supervisor. */
function hostSource(): {
  connection: Pick<ConnectionHandle, 'generation'>
  publish(available: boolean): void
} {
  let current: typeof GENERATION | undefined = GENERATION
  const listeners = new Set<() => void>()
  return {
    connection: {
      generation: {
        getSnapshot: () => current,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      },
    },
    publish: (available) => {
      current = available ? GENERATION : undefined
      for (const listener of listeners) listener()
    },
  }
}

interface Generation {
  readonly values?: readonly (Snapshot | Delta)[]
  readonly terminal?: Error
  readonly hold?: boolean
}

/** One physical generation per opener call: scripted values, then an optional hold until abort. */
function scripted(generations: Generation[]): (signal: AbortSignal) => AsyncIterable<Snapshot | Delta> {
  return (signal: AbortSignal): AsyncIterable<Snapshot | Delta> => ({
    async * [Symbol.asyncIterator](): AsyncIterator<Snapshot | Delta> {
      const generation = generations.shift()
      if (generation === undefined) throw new Error('fixture has no stream generation')
      for (const value of generation.values ?? []) yield value
      if (generation.terminal !== undefined) throw generation.terminal
      if (generation.hold === true && !signal.aborted) {
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => { resolve() }, { once: true })
        })
      }
    },
  })
}

interface SnapshotFixture {
  readonly subject: RemoteSnapshotStream<Snapshot, Delta>
  readonly replaced: Snapshot[]
  readonly updated: Delta[]
  readonly failures: unknown[]
}

/** Mount one snapshot stream over a real reconnecting Remote stream with recording domain callbacks. */
function mount(generations: Generation[], replace?: (value: Snapshot) => void): SnapshotFixture {
  const replaced: Snapshot[] = []
  const updated: Delta[] = []
  const failures: unknown[] = []
  const stream = new RemoteStream<Snapshot | Delta>(hostSource().connection, {
    name: 'fixture snapshot stream',
    open: scripted(generations),
    ended: accepted => accepted
      ? new RemoteStreamCarrierError('accepted generation ended')
      : new Error('generation ended before acceptance'),
  })
  const subject = new RemoteSnapshotStream<Snapshot, Delta>(stream, {
    name: 'fixture snapshot stream',
    isSnapshot: (value): value is Snapshot => 'snapshot' in value,
    replace: replace ?? ((value) => { replaced.push(value) }),
    update: (value) => { updated.push(value) },
    failed: (error) => { failures.push(error) },
  })
  return { subject, replaced, updated, failures }
}

describe('RemoteSnapshotStream', () => {
  it('applies the opening snapshot and later deltas, and starts only once', async () => {
    const fixture = mount([{ values: [snap(1), delta(2), delta(3)], hold: true }])
    fixture.subject.start()
    fixture.subject.start()

    await vi.waitFor(() => { expect(fixture.updated).toEqual([delta(2), delta(3)]) })
    expect(fixture.replaced).toEqual([snap(1)])
    expect(fixture.failures).toEqual([])
    await fixture.subject.dispose()
  })

  it('republishes the snapshot when a replacement generation opens', async () => {
    const fixture = mount([
      { values: [snap(1), delta(2)], hold: true },
      { values: [snap(10), delta(11)], hold: true },
    ])
    fixture.subject.start()
    await vi.waitFor(() => { expect(fixture.updated).toEqual([delta(2)]) })

    fixture.subject.restart()

    await vi.waitFor(() => {
      expect(fixture.replaced).toEqual([snap(1), snap(10)])
      expect(fixture.updated).toEqual([delta(2), delta(11)])
    })
    expect(fixture.failures).toEqual([])
    await fixture.subject.dispose()
  })

  it('publishes a protocol failure for a second opening snapshot in one generation', async () => {
    const fixture = mount([{ values: [snap(1), snap(2)] }])
    fixture.subject.start()

    await vi.waitFor(() => { expect(fixture.failures).toHaveLength(1) })
    expect(fixture.failures[0]).toMatchObject({
      isOCEANRemoteError: true,
      code: 'gateway/internal',
      message: 'fixture snapshot stream emitted more than one opening snapshot',
    })
    expect(fixture.replaced).toEqual([snap(1)])
    expect(fixture.updated).toEqual([])
    await fixture.subject.dispose()
  })

  it('publishes a protocol failure for an update before the opening snapshot', async () => {
    const fixture = mount([{ values: [delta(1)] }])
    fixture.subject.start()

    await vi.waitFor(() => { expect(fixture.failures).toHaveLength(1) })
    expect(fixture.failures[0]).toMatchObject({
      isOCEANRemoteError: true,
      code: 'gateway/internal',
      message: 'fixture snapshot stream emitted an update before its opening snapshot',
    })
    expect(fixture.replaced).toEqual([])
    expect(fixture.updated).toEqual([])
    await fixture.subject.dispose()
  })

  it('publishes the terminal failure of a generation that ended before acceptance', async () => {
    const fixture = mount([{}])
    fixture.subject.start()

    await vi.waitFor(() => { expect(fixture.failures).toHaveLength(1) })
    expect(fixture.failures[0]).toMatchObject({
      isOCEANRemoteError: true,
      code: 'gateway/internal',
      message: 'generation ended before acceptance',
    })
    await fixture.subject.dispose()
  })

  it('publishes a marked Host failure verbatim', async () => {
    const failure = new RemoteError('gateway/internal', 'host stream failed', {})
    const fixture = mount([{ terminal: failure }])
    fixture.subject.start()

    await vi.waitFor(() => { expect(fixture.failures).toHaveLength(1) })
    expect(fixture.failures[0]).toBe(failure)
    await fixture.subject.dispose()
  })

  it('suppresses failure publication once the domain owner disposes during apply', async () => {
    const holder: { subject?: RemoteSnapshotStream<Snapshot, Delta> } = {}
    const applied: Snapshot[] = []
    const fixture = mount([{ values: [snap(1)] }], (value) => {
      applied.push(value)
      void holder.subject?.dispose()
      throw new Error('domain apply failed')
    })
    holder.subject = fixture.subject
    fixture.subject.start()

    await vi.waitFor(() => { expect(applied).toEqual([snap(1)]) })
    await fixture.subject.dispose()
    expect(fixture.updated).toEqual([])
    expect(fixture.failures).toEqual([])
  })

  it('can be disposed before start and consumes nothing afterwards', async () => {
    const fixture = mount([{ values: [snap(1)] }])
    await fixture.subject.dispose()

    fixture.subject.start()
    fixture.subject.restart()

    await fixture.subject.dispose()
    expect(fixture.replaced).toEqual([])
    expect(fixture.updated).toEqual([])
    expect(fixture.failures).toEqual([])
  })
})
