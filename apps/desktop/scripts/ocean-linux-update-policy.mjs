/** Fail-closed transaction decisions for a future Linux installer. No filesystem or process effects. */
const phases = new Set(['staged', 'quiescing', 'ready', 'activating', 'checking', 'complete', 'recovery'])

function check(record) {
  const keys = ['format', 'id', 'revision', 'phase', 'from', 'to', 'sha256']
  if (!record || Object.keys(record).length !== keys.length || keys.some(key => !Object.hasOwn(record, key))) throw new Error('Invalid update transaction fields')
  if (!record || record.format !== 1 || !phases.has(record.phase) || !Number.isSafeInteger(record.revision) || record.revision < 0 || record.revision >= Number.MAX_SAFE_INTEGER || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id)) throw new Error('Invalid update transaction')
  if (typeof record.from !== 'string' || typeof record.to !== 'string' || !/^[0-9A-Za-z.+-]{1,128}$/.test(record.from) || !/^[0-9A-Za-z.+-]{1,128}$/.test(record.to) || record.from === record.to) throw new Error('Invalid version transition')
  if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('Invalid staged digest')
}

/** Record a candidate only after signature, extraction safety, layout, and native smoke checks.
 * @param {object} candidate Trusted id, from/to versions, and signed archive sha256.
 * @returns {object} Initial transaction; persistence is the caller's responsibility.
 */
export function stagedLinuxUpdate(candidate) {
  const record = { format: 1, id: candidate.id, revision: 0, phase: 'staged', from: candidate.from, to: candidate.to, sha256: candidate.sha256 }
  check(record)
  return record
}

/** Calculate one write-ahead transition. Persist it before executing any returned effect.
 * @param {object} record Last durable transaction.
 * @param {object} event Main-process event with transactionId, expectedRevision, and phase-specific facts. signatureStillValid requires fresh full manifest verification, including expiry and the durable sequence floor.
 * @returns {{record: object, effect: string}} Next record and the single permitted installer operation.
 */
export function advanceLinuxUpdate(record, event) {
  check(record)
  if (!event || event.transactionId !== record.id) throw new Error('Wrong update transaction')
  if (event.expectedRevision !== record.revision) throw new Error('Stale update decision')
  const transition = (phase, effect) => {
    const next = { ...record, revision: record.revision + 1, phase }
    check(next)
    return { record: next, effect }
  }
  if (event.type === 'failure' && !['complete', 'recovery'].includes(record.phase)) return transition('recovery', 'inspect-state')
  switch (record.phase) {
    case 'staged':
      if (event.type === 'install-approved' && event.approvedFromVersion === record.from && event.approvedToVersion === record.to && event.approvedSha256 === record.sha256 && event.explicitApproval === true && event.signatureStillValid === true && event.stageStillValid === true) return transition('quiescing', 'lock-admission-and-drain')
      break
    case 'quiescing':
      if (event.type === 'host-stopped' && event.admissionLocked === true && event.drainComplete === true && event.taskStateKnown === true && event.activeTasks === 0 && event.teardownAcknowledged === true && event.consistentBackupVerified === true) return transition('ready', 'reverify-stage')
      break
    case 'ready':
      if (event.type === 'stage-reverified' && event.signatureStillValid === true && event.sha256 === record.sha256 && event.previousInstallRetained === true && event.profileUpgradeAllowed === true && event.hostStillStopped === true && event.admissionLocked === true) return transition('activating', 'atomic-launcher-switch')
      break
    case 'activating':
      if (event.type === 'switch-confirmed' && event.targetVersion === record.to) return transition('checking', 'start-and-check-local-runtime')
      break
    case 'checking':
      if (event.type === 'health-confirmed' && event.version === record.to && event.runtimeReady === true) return transition('complete', 'retain-previous-install')
      break
  }
  throw new Error('Unsafe or out-of-order update transition')
}

/** Determine conservative recovery work from the last persisted phase, never replaying side effects.
 * @param {object} record Persisted transaction whose filesystem/process effects may be uncertain.
 * @returns {string} Required inspection; no recommendation authorizes restart, downgrade, or data restore.
 */
export function inspectInterruptedLinuxUpdate(record) {
  check(record)
  if (record.phase === 'complete') return 'verify-current-install'
  if (record.phase === 'staged') return 'reverify-stage-and-request-install-approval'
  if (record.phase === 'quiescing' || record.phase === 'ready') return 'inspect-host-lock-and-current-install'
  return 'inspect-launcher-runtime-and-profile-before-recovery'
}

/** Decide whether a separately approved binary-only rollback is safe; never restore data automatically.
 * @param {object} evidence Fresh main-process observations after stopping writes.
 * @returns {boolean} True only with an independently verified compatible profile and retained executable.
 */
export function canRollbackLinuxBinary(evidence) {
  return evidence?.explicitApproval === true && evidence.admissionLocked === true && evidence.drainComplete === true && evidence.taskStateKnown === true && evidence.activeTasks === 0 && evidence.teardownAcknowledged === true && evidence.previousInstallVerified === true && evidence.profileCompatibleWithPrevious === true && evidence.profileWritesStopped === true
}
