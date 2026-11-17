/**
 * Regression guard for sessions whose final physical frame was interrupted by a
 * process kill mid-append: across provider restarts the session stays listed and
 * stat-able, read handles return the committed history, the query corpus keeps it
 * visible, and the next write handle repairs the torn tail before appending.
 * Added with the 0.2.2-rc.2 acceptance follow-up, where a session that vanished
 * from the sidebar turned out to be the archive filter; this spec pins the
 * interrupted-tail path itself so a future listing or decode change cannot
 * silently drop such sessions.
 * @module */
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionSeq, SESSION_FORMAT_VERSION } from '@ocean/ocean-session'
import type { SessionEvent } from '@ocean/ocean-session'
import SessionStore from '@ocean/ocean-session'
import SqliteSessionQueryEngine from '@ocean/ocean-session-query-sqlite'
import * as JsonlSessionPersistence from '@ocean/ocean-session-persistence-jsonl'
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { meta, oneTurnLog } from '../../session-persistence/tests/contract.ts'
import { generationLogPath } from '../src/format.ts'
import { compressZstdFrame, scanZstdFrames } from '../src/zstd.ts'

const roots: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

/** One provider boot over `root`; a fresh context models one process lifetime. */
async function boot(root: string, compression: 'none' | 'zstd', query = false): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(JsonlSessionPersistence, { root, compression })
  if (query) {
    await ctx.plugin(SessionStore)
    await ctx.plugin(SqliteSessionQueryEngine, { path: join(root, 'session-query.db') })
  }
  return ctx
}

/** A contiguous second turn starting after one committed one-turn log. */
function secondTurn(): SessionEvent[] {
  return [
    { type: 'turn/start', seq: SessionSeq(6), time: 7, data: { turn: 2 } },
    { type: 'turn/end', seq: SessionSeq(7), time: 8, data: { turn: 2, reason: { kind: 'completed' } } },
  ] as SessionEvent[]
}

describe.each(['none', 'zstd'] as const)('interrupted tail (%s)', (compression) => {
  it('stays listed, readable with committed history, and repairable across restarts', async () => {
    const root = await mkdtemp(join(tmpdir(), `ocean-torn-tail-${compression}-`))
    roots.push(root)
    const header = meta(`torn-tail-${compression}`, '/work')
    const committed = oneTurnLog()

    // Process 1: commit one turn, then die mid-append leaving a torn physical tail.
    const first = await boot(root, compression)
    const handle = await first.sessionPersistence.create(header)
    await handle.append(committed)
    await handle.flush()
    await handle.close()
    const path = generationLogPath(root, header.cwd, header.id, SESSION_FORMAT_VERSION, compression)
    const tornLine = `${JSON.stringify(secondTurn()[0])}\n`
    if (compression === 'zstd') {
      const frame = await compressZstdFrame(Buffer.from(tornLine))
      // Keep only the frame magic and header bytes: no plaintext is recoverable.
      await appendFile(path, frame.subarray(0, 8))
    } else {
      await appendFile(path, tornLine.slice(0, tornLine.length - 2))
    }
    await first.fiber.dispose()

    // Process 2: listing, stat, read, and corpus visibility survive the torn tail.
    const second = await boot(root, compression, true)
    const persistence = second.sessionPersistence
    expect((await persistence.list()).map(row => row.header.id)).toContain(header.id)
    expect(await persistence.stat(header.id)).toBeDefined()
    const read = await persistence.open(header.id, 'read')
    try {
      expect(await read.read()).toMatchObject({ events: committed })
    } finally {
      await read.close()
    }
    expect((await second.sessionQuery.listSessions()).map(record => record.header.id)).toContain(header.id)

    // The next write handle repairs the torn tail before appending new events.
    const write = await persistence.open(header.id, 'write')
    try {
      await write.append(secondTurn())
      await write.flush()
    } finally {
      await write.close()
    }
    await second.fiber.dispose()

    // Process 3: the repaired log holds exactly the committed plus appended events.
    const third = await boot(root, compression)
    const repaired = await third.sessionPersistence.open(header.id, 'read')
    try {
      expect((await repaired.read()).events).toEqual([...committed, ...secondTurn()])
    } finally {
      await repaired.close()
    }
    if (compression === 'zstd') {
      const scan = scanZstdFrames(await readFile(path))
      expect(scan.tornStart).toBeUndefined()
    } else {
      const bytes = await readFile(path)
      expect(bytes.at(-1)).toBe(0x0A)
    }
    await third.fiber.dispose()
  })
})
