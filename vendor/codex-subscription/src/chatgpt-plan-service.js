/** Host-only orchestration for an independently stored ChatGPT plan grant. */
import { startPlanLogin } from './chatgpt-plan-loopback.js'
import { exchangePlanCode, listPlanModels, refreshPlanGrant, revokePlanGrant } from './chatgpt-plan-protocol.js'

/** Create a login owner whose public status excludes grants. @param {object} options - Vault, timeout and transport operations. @returns {object} The host-only service. */
export function createPlanService({ vault, timeoutMs, fetch: request = fetch, startLogin = startPlanLogin, listModels = listPlanModels, refreshGrant = refreshPlanGrant, revocationTimeoutMs = 10000, revocationAttempts = 2, revocationRetryDelayMs = 500, onAccountChanged = () => {}, onCatalog = () => {} }) {
  let phase = 'idle', active, task = Promise.resolve(), generation = 0, committing = false, mutating = false, cleanupUnconfirmed = false
  const revoke = async grant => {
    for (let attempt = 0; attempt < revocationAttempts; attempt++) {
      const controller = new AbortController()
      let timer
      try {
        await Promise.race([
          revokePlanGrant({ grant, fetch: request, signal: controller.signal }),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('ChatGPT revocation timed out')) }, revocationTimeoutMs) }),
        ])
        return
      } catch (error) {
        if (error?.retryable === false || attempt + 1 === revocationAttempts) throw error
        await new Promise(resolve => setTimeout(resolve, revocationRetryDelayMs * (2 ** attempt)))
      } finally { clearTimeout(timer) }
    }
  }
  const discard = async grant => {
    try {
      if (await vault.grantState(grant) !== 'absent') { cleanupUnconfirmed = true; return }
      await revoke(grant)
    } catch { cleanupUnconfirmed = true }
  }
  return Object.freeze({
    async start(label, { renewId } = {}) {
      if (phase === 'starting' || phase === 'waiting_browser' || committing || mutating) throw new Error('ChatGPT sign-in is already in progress')
      const current = ++generation
      phase = 'starting'
      try {
        const hostId = await vault.hostId()
        const registration = renewId === undefined ? undefined : await vault.registration(renewId)
        if (current !== generation) throw new Error('ChatGPT sign-in cancelled')
        const login = await startLogin({ hostId, timeoutMs, registration, onDiscard: discard, exchange: options => exchangePlanCode({ ...options, fetch: request, onUncommitted: discard, onUnknown: () => { cleanupUnconfirmed = true } }) })
        if (current !== generation) { void login.completion.catch(() => {}); await login.cancel(); throw new Error('ChatGPT sign-in cancelled') }
        active = login
        phase = 'waiting_browser'
        task = login.completion.then(async grant => {
          if (current !== generation) { await discard(grant); return }
          committing = true
          try { onAccountChanged(); await vault.add(grant, label); phase = 'authenticated' } catch (error) { try { const state = await vault.grantState(grant); if (state === 'absent') await discard(grant); else if (state === 'uncertain') cleanupUnconfirmed = true } catch { cleanupUnconfirmed = true }; throw error } finally { committing = false }
        }).catch(() => { if (current === generation) phase = 'failed' }).finally(() => { if (active === login) active = undefined })
        return { phase, url: login.url }
      } catch (error) {
        if (current === generation) phase = 'failed'
        throw error
      }
    },
    async cancel() {
      if (committing) { await task; return }
      generation++
      phase = 'cancelled'
      await active?.cancel()
    },
    async status() { return { phase, cleanupUnconfirmed, ...(await vault.status()) } },
    async select(id) {
      if (phase === 'starting' || phase === 'waiting_browser' || committing || mutating) throw new Error('ChatGPT sign-in is in progress')
      mutating = true
      generation++
      onAccountChanged()
      try { await vault.select(id); phase = 'idle' } finally { mutating = false; onAccountChanged() }
    },
    async recoverSignOut(id) {
      if (phase === 'starting' || phase === 'waiting_browser' || committing || mutating) throw new Error('ChatGPT sign-in is in progress')
      mutating = true
      generation++
      onAccountChanged()
      try {
        const result = await vault.recoverSignOut(id)
        cleanupUnconfirmed = true
        phase = 'idle'
        return result
      } finally { mutating = false; onAccountChanged() }
    },
    async signOut(id) {
      if (phase === 'starting' || phase === 'waiting_browser' || committing || mutating) throw new Error('ChatGPT sign-in is in progress')
      mutating = true
      generation++
      onAccountChanged()
      try {
      const result = await vault.signOut({ id, revoke })
      if (!result.remoteRevoked) cleanupUnconfirmed = true
      phase = 'idle'
      return result
      } finally { mutating = false; onAccountChanged() }
    },
    async accessToken(expectedId) {
      if (committing || mutating || !expectedId) throw new Error('ChatGPT account unavailable')
      const current = generation
      const grant = await vault.fresh({ expectedId, onDiscard: discard, onUnknown: () => { cleanupUnconfirmed = true }, now: Date.now(), refresh: grant => refreshGrant({ grant, fetch: request, onUncommitted: discard, onUnknown: () => { cleanupUnconfirmed = true } }) })
      if (current !== generation) throw new Error('ChatGPT account changed')
      return grant.accessToken
    },
    async models({ signal } = {}) {
      signal?.throwIfAborted()
      if (committing || mutating) throw new Error('ChatGPT account unavailable')
      const current = generation
      const selected = await vault.status()
      if (!selected.activeId || current !== generation || committing || mutating) throw new Error('ChatGPT account unavailable')
      const grant = await vault.fresh({ expectedId: selected.activeId, onDiscard: discard, onUnknown: () => { cleanupUnconfirmed = true }, now: Date.now(), refresh: grant => refreshGrant({ grant, fetch: request, onUncommitted: discard, onUnknown: () => { cleanupUnconfirmed = true } }) })
      signal?.throwIfAborted()
      if (current !== generation) throw new Error('ChatGPT account changed')
      const models = await listModels({ accessToken: grant.accessToken, fetch: request, signal })
      signal?.throwIfAborted()
      if (current !== generation) throw new Error('ChatGPT account changed')
      return onCatalog(models, selected.activeId) ?? models
    },
    async settle() { await task },
  })
}
