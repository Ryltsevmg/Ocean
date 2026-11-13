import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stagedLinuxUpdate, advanceLinuxUpdate, inspectInterruptedLinuxUpdate, canRollbackLinuxBinary } from './ocean-linux-update-policy.mjs'

const initial = () => stagedLinuxUpdate({ id: 'test-transaction', from: '0.2.1', to: '0.2.2', sha256: 'a'.repeat(64) })
const events = [
  { type: 'install-approved', approvedFromVersion: '0.2.1', approvedToVersion: '0.2.2', approvedSha256: 'a'.repeat(64), explicitApproval: true, signatureStillValid: true, stageStillValid: true },
  { type: 'host-stopped', admissionLocked: true, drainComplete: true, taskStateKnown: true, activeTasks: 0, teardownAcknowledged: true, consistentBackupVerified: true },
  { type: 'stage-reverified', signatureStillValid: true, sha256: 'a'.repeat(64), previousInstallRetained: true, profileUpgradeAllowed: true, hostStillStopped: true, admissionLocked: true },
  { type: 'switch-confirmed', targetVersion: '0.2.2' },
  { type: 'health-confirmed', version: '0.2.2', runtimeReady: true },
].map(event => ({ ...event, transactionId: 'test-transaction' }))

test('update requires ordered authorization, quiescence, retained fallback and runtime health', () => {
  let state = initial()
  const phases = ['quiescing', 'ready', 'activating', 'checking', 'complete']
  for (const [index, event] of events.entries()) {
    assert.throws(() => advanceLinuxUpdate(state, { ...event, expectedRevision: state.revision + 1 }), /Stale/)
    for (const key of Object.keys(event).filter(key => key !== 'type' && key !== 'transactionId')) {
      const bad = { ...event, expectedRevision: state.revision }
      delete bad[key]
      assert.throws(() => advanceLinuxUpdate(state, bad), /Unsafe/)
    }
    const result = advanceLinuxUpdate(state, { ...event, expectedRevision: state.revision })
    assert.equal(result.record.phase, phases[index])
    assert.equal(state.revision, index, 'input record is not mutated')
    state = result.record
  }
  assert.throws(() => advanceLinuxUpdate(state, { ...events[0], expectedRevision: state.revision }), /Unsafe/)
})

test('active or unknown work, unverified backup and unexpected archive prohibit switching', () => {
  const quiescing = advanceLinuxUpdate(initial(), { ...events[0], expectedRevision: 0 }).record
  for (const patch of [{ activeTasks: 1 }, { activeTasks: -1 }, { activeTasks: NaN }, { taskStateKnown: false }, { drainComplete: false }, { consistentBackupVerified: false }, { teardownAcknowledged: false }]) assert.throws(() => advanceLinuxUpdate(quiescing, { ...events[1], ...patch, expectedRevision: 1 }))
  const ready = advanceLinuxUpdate(quiescing, { ...events[1], expectedRevision: 1 }).record
  assert.throws(() => advanceLinuxUpdate(ready, { ...events[2], sha256: 'b'.repeat(64), expectedRevision: 2 }))
})

test('interruption at every phase requires inspection, not automatic replay or downgrade', () => {
  let state = initial()
  for (const event of events) {
    assert.match(inspectInterruptedLinuxUpdate(state), /inspect|reverify/)
    const failed = advanceLinuxUpdate(state, { type: 'failure', transactionId: state.id, expectedRevision: state.revision })
    assert.equal(failed.record.phase, 'recovery')
    assert.throws(() => advanceLinuxUpdate(failed.record, { ...events[0], expectedRevision: failed.record.revision }))
    state = advanceLinuxUpdate(state, { ...event, expectedRevision: state.revision }).record
  }
  assert.equal(inspectInterruptedLinuxUpdate(state), 'verify-current-install')
})

test('binary rollback refuses unknown or migrated profiles even when a backup exists', () => {
  const evidence = { explicitApproval: true, admissionLocked: true, drainComplete: true, taskStateKnown: true, activeTasks: 0, teardownAcknowledged: true, previousInstallVerified: true, profileCompatibleWithPrevious: true, profileWritesStopped: true }
  assert.equal(canRollbackLinuxBinary(evidence), true)
  for (const key of Object.keys(evidence)) {
    const incomplete = { ...evidence }; delete incomplete[key]
    assert.equal(canRollbackLinuxBinary(incomplete), false)
  }
  assert.equal(canRollbackLinuxBinary({ ...evidence, profileCompatibleWithPrevious: false, backupExists: true }), false)
  assert.equal(canRollbackLinuxBinary({ ...evidence, activeTasks: 1 }), false)
})

test('persisted unknown schemas and malformed revisions are not resumed', () => {
  for (const patch of [{ format: 2 }, { revision: -1 }, { revision: Number.MAX_SAFE_INTEGER }, { revision: 0.5 }, { phase: 'surprise' }, { injected: true }, { id: '../path' }, { sha256: 'bad' }, { to: '0.2.1' }]) {
    const invalid = { ...initial(), ...patch }
    assert.throws(() => inspectInterruptedLinuxUpdate(invalid))
    assert.throws(() => advanceLinuxUpdate(invalid, { ...events[0], expectedRevision: invalid.revision }))
  }
})


test('events from another transaction cannot advance any phase, including failure', () => {
  let a = initial()
  let b = stagedLinuxUpdate({ ...initial(), id: 'other-transaction' })
  for (const event of events) {
    const fromA = { ...event, transactionId: a.id, expectedRevision: a.revision }
    assert.equal(a.revision, b.revision)
    assert.throws(() => advanceLinuxUpdate(b, fromA), /Wrong update transaction/)
    assert.throws(() => advanceLinuxUpdate(b, { type: 'failure', transactionId: a.id, expectedRevision: b.revision }), /Wrong update transaction/)
    assert.throws(() => advanceLinuxUpdate(b, { ...event, transactionId: undefined, expectedRevision: b.revision }), /Wrong update transaction/)
    a = advanceLinuxUpdate(a, fromA).record
    b = advanceLinuxUpdate(b, { ...event, transactionId: b.id, expectedRevision: b.revision }).record
  }
})

test('installation approval binds the exact source, target and archive, not just the transaction', () => {
  const approval = { ...events[0], expectedRevision: 0 }
  for (const patch of [{ approvedFromVersion: '0.2.0' }, { approvedToVersion: '0.2.3' }, { approvedSha256: 'b'.repeat(64) }]) {
    assert.throws(() => advanceLinuxUpdate(initial(), { ...approval, ...patch }), /Unsafe/)
  }
  assert.throws(() => advanceLinuxUpdate({ ...initial(), sha256: 'b'.repeat(64) }, approval), /Unsafe/)
  assert.throws(() => advanceLinuxUpdate({ ...initial(), to: '0.2.3' }, approval), /Unsafe/)
})

test('activation rejects expired or revoked metadata after task drain', () => {
  const quiescing = advanceLinuxUpdate(initial(), { ...events[0], expectedRevision: 0 }).record
  const ready = advanceLinuxUpdate(quiescing, { ...events[1], expectedRevision: 1 }).record
  assert.throws(() => advanceLinuxUpdate(ready, { ...events[2], signatureStillValid: false, expectedRevision: 2 }), /Unsafe/)
})
