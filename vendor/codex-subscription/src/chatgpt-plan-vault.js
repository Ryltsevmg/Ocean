/** Isolated credential record for ChatGPT plan registrations. */
import { randomUUID } from 'node:crypto'

const present = value => typeof value === 'string' && value.length > 0
const hostPattern = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const grantRecord = payload => ({ kind: 'grant', payload })

function readPayload(record) {
  if (record === undefined) return undefined
  const value = record?.payload
  if (record?.kind !== 'grant' || value?.version !== 1 || !hostPattern.test(value.hostId) || !Array.isArray(value.accounts) || (value.activeId !== undefined && !value.accounts.some(account => account?.id === value.activeId))) throw new Error('ChatGPT plan credential record is malformed')
  const seen = new Set(), clients = new Set()
  for (const account of value.accounts) {
    const grant = account?.grant
    if ((account?.retired !== undefined && typeof account.retired !== 'boolean') || (account?.revocationUnconfirmed !== undefined && typeof account.revocationUnconfirmed !== 'boolean') || (account?.retired && (!account.signedOut || account.revocationPending))) throw new Error('ChatGPT retirement state is malformed')
    if (!present(account?.id) || seen.has(account.id) || !present(account.label) || (account.reauthorizationRequired !== undefined && typeof account.reauthorizationRequired !== 'boolean') || (account.refreshPending !== undefined && typeof account.refreshPending !== 'boolean') || !present(grant?.clientId) || clients.has(grant.clientId) || !present(grant.subject) || grant.hostId !== value.hostId || (account.signedOut !== undefined && typeof account.signedOut !== 'boolean') || (account.revocationPending !== undefined && typeof account.revocationPending !== 'boolean') || (account.signedOut ? (grant.accessToken !== undefined || grant.refreshToken !== undefined || grant.idToken !== undefined) : (!present(grant.accessToken) || !present(grant.refreshToken) || !present(grant.idToken) || !Number.isFinite(grant.expiresAt) || !Array.isArray(grant.scopes) || !grant.scopes.includes('chatgpt.tokens.use.direct') || !grant.scopes.includes('resource.invoke'))) ) throw new Error('ChatGPT plan credential record is malformed')
    seen.add(account.id)
    clients.add(grant.clientId)
  }
  return value
}

/** Own a dedicated record without touching the legacy Codex account. @param {object} options - Credential service, record key and identifier source. @returns {object} The host-only vault. */
export function createPlanVault({ credentials, key, createId = randomUUID }) {
  let refreshTail = Promise.resolve()
  const grantState = async grant => {
    const value = readPayload(await credentials.modifyRecord(key, async () => undefined))
    const account = value?.accounts.find(candidate => candidate.grant.clientId === grant.clientId)
    if (!account) return 'absent'
    return account.grant.subject === grant.subject && account.grant.refreshToken === grant.refreshToken ? 'stored' : 'uncertain'
  }
  return Object.freeze({
    async hostId() {
      const record = await credentials.modifyRecord(key, async current => {
        if (current !== undefined) { readPayload(current); return current }
        const hostId = `urn:uuid:${createId()}`
        if (!hostPattern.test(hostId)) throw new Error('ChatGPT host identifier is invalid')
        return grantRecord({ version: 1, hostId, accounts: [] })
      })
      return readPayload(record).hostId
    },
    async add(grant, label) {
      if (!present(label) || label.trim().length === 0 || label.length > 48) throw new Error('ChatGPT account label is invalid')
      const record = await credentials.modifyRecord(key, async current => {
        const value = readPayload(current)
        if (value === undefined || value.hostId !== grant.hostId) throw new Error('ChatGPT host identifier does not match')
        const existing = value.accounts.find(account => account.grant.clientId === grant.clientId)
        if (existing && existing.grant.subject !== grant.subject) throw new Error('ChatGPT account identity does not match')
        if (existing?.retired) throw new Error('ChatGPT registration is retired; create a new sign-in')
        if (existing?.revocationPending) throw new Error('ChatGPT session revocation is in progress')
        const id = existing?.id ?? createId()
        const accounts = existing ? value.accounts.map(account => account.id === id ? { ...account, grant, reauthorizationRequired: false, refreshPending: false, signedOut: false, revocationPending: false, revocationUnconfirmed: false } : account) : [...value.accounts, { id, label: label.trim(), grant }]
        const next = grantRecord({ ...value, activeId: id, accounts })
        readPayload(next)
        return next
      })
      readPayload(record)
    },
    grantState,
    async status() {
      const value = readPayload(await credentials.readRecord(key))
      return { activeId: value?.activeId, accounts: value?.accounts.map(account => ({ id: account.id, label: account.label, retired: account.retired === true, revocationPending: account.revocationPending === true, revocationUnconfirmed: account.revocationUnconfirmed === true, signedOut: account.signedOut === true, reauthorizationRequired: account.signedOut === true || account.revocationPending === true || account.reauthorizationRequired === true || account.refreshPending === true })) ?? [] }
    },
    async select(id) {
      if (!present(id)) throw new Error('ChatGPT account identifier is invalid')
      await credentials.modifyRecord(key, async current => {
        const value = readPayload(current)
        if (!value?.accounts.some(account => account.id === id)) throw new Error('ChatGPT account is unavailable')
        return grantRecord({ ...value, activeId: id })
      })
    },
    async registration(id) {
      const value = readPayload(await credentials.readRecord(key))
      const account = value?.accounts.find(candidate => candidate.id === id)
      if (!account || account.retired || account.revocationPending) throw new Error('ChatGPT account is unavailable')
      return { clientId: account.grant.clientId, subject: account.grant.subject }
    },
    async readActive() {
      const value = readPayload(await credentials.readRecord(key))
      const account = value?.accounts.find(candidate => candidate.id === value.activeId)
      return account === undefined || account.signedOut || account.revocationPending ? undefined : structuredClone(account.grant)
    },
    async recoverSignOut(id) {
      if (!present(id)) throw new Error('ChatGPT plan account identifier is invalid')
      await credentials.modifyRecord(key, async current => {
        const value = readPayload(current)
        const account = value?.accounts.find(candidate => candidate.id === value.activeId)
        if (!account || account.id !== id || !account.revocationPending) throw new Error('ChatGPT pending revocation is unavailable')
        const { clientId, subject, hostId } = account.grant
        // Never reuse this registration: another host's remote revoke may still finish.
        return grantRecord({ ...value, accounts: value.accounts.map(candidate => candidate.id === id ? { ...candidate, grant: { clientId, subject, hostId }, signedOut: true, retired: true, revocationPending: false, refreshPending: false, revocationUnconfirmed: true } : candidate) })
      })
      return { remoteRevoked: false }
    },
    async signOut({ id, revoke }) {
      if (!present(id)) throw new Error('ChatGPT plan account identifier is invalid')
      let grant, uncertain = false
      await credentials.modifyRecord(key, async current => {
        const value = readPayload(current)
        const account = value?.accounts.find(candidate => candidate.id === value.activeId)
        if (!account || account.id !== id || account.signedOut || account.revocationPending) throw new Error('ChatGPT plan account is unavailable')
        grant = structuredClone(account.grant)
        uncertain = account.refreshPending === true
        if (uncertain) {
          const { clientId, subject, hostId } = account.grant
          return grantRecord({ ...value, accounts: value.accounts.map(candidate => candidate.id === id ? { ...candidate, grant: { clientId, subject, hostId }, signedOut: true, revocationPending: false, refreshPending: false, revocationUnconfirmed: true, retired: true } : candidate) })
        }
        return grantRecord({ ...value, accounts: value.accounts.map(candidate => candidate.id === id ? { ...candidate, revocationPending: true } : candidate) })
      })
      if (uncertain) return { remoteRevoked: false }
      let remoteRevoked = false
      try { await revoke(grant); remoteRevoked = true } catch { /* Remote revocation remains unconfirmed. */ }
      await credentials.modifyRecord(key, async current => {
        const value = readPayload(current)
        const account = value?.accounts.find(candidate => candidate.id === id)
        if (!account?.revocationPending || account.grant.refreshToken !== grant.refreshToken) throw new Error('ChatGPT plan registration changed during sign-out')
        const { clientId, subject, hostId } = account.grant
        return grantRecord({ ...value, accounts: value.accounts.map(candidate => candidate.id === id ? { ...candidate, grant: { clientId, subject, hostId }, signedOut: true, revocationPending: false, refreshPending: false, revocationUnconfirmed: !remoteRevoked, retired: !remoteRevoked } : candidate) })
      })
      return { remoteRevoked }
    },
    fresh({ now, refresh, expectedId, onDiscard = async () => {}, onUnknown = () => {} }) {
      const operation = refreshTail.then(async () => {
      if (!Number.isFinite(now)) throw new Error('ChatGPT refresh time is invalid')
      let owner
      const initial = await credentials.modifyRecord(key, async current => {
        const value = readPayload(current)
        const account = value?.accounts.find(candidate => candidate.id === value.activeId)
        if (!account || (expectedId !== undefined && account.id !== expectedId)) throw new Error('ChatGPT plan credential unavailable')
        if (account.signedOut || account.revocationPending || account.reauthorizationRequired || account.refreshPending || account.grant.expiresAt > now) return undefined
        owner = account.id
        return grantRecord({ ...value, accounts: value.accounts.map(candidate => candidate.id === owner ? { ...candidate, refreshPending: true } : candidate) })
      })
      const value = readPayload(initial)
      const account = value?.accounts.find(candidate => candidate.id === value.activeId)
      if (!account || (expectedId !== undefined && account.id !== expectedId)) throw new Error('ChatGPT plan credential unavailable')
      if (owner === undefined) {
        if (account.signedOut || account.revocationPending || account.reauthorizationRequired || account.refreshPending) throw new Error('ChatGPT plan refresh outcome is unknown; sign in again')
        return structuredClone(account.grant)
      }
      let grant, committed
      try {
        grant = await refresh(structuredClone(account.grant))
        if (grant?.clientId !== account.grant.clientId || grant?.subject !== account.grant.subject || grant?.hostId !== value.hostId || grant?.expiresAt <= now) throw new Error('ChatGPT refreshed credential is invalid')
        const result = await credentials.modifyRecord(key, async current => {
          const latest = readPayload(current)
          const found = latest?.accounts.find(candidate => candidate.id === owner)
          if (!found?.refreshPending || found.grant.refreshToken !== account.grant.refreshToken) throw new Error('ChatGPT registration changed during refresh')
          const next = grantRecord({ ...latest, accounts: latest.accounts.map(candidate => candidate.id === owner ? { ...candidate, grant, refreshPending: false } : candidate) })
          readPayload(next)
          return next
        })
        committed = readPayload(result)
      } catch {
        if (grant !== undefined) {
          try {
            const state = await grantState(grant)
            if (state === 'absent') await onDiscard(grant)
            else if (state === 'uncertain') onUnknown()
          } catch { onUnknown() }
        }
        // A persisted pending marker prevents reuse after a crash or failed write.
        throw new Error('ChatGPT plan refresh outcome is unknown; sign in again')
      }
      if (expectedId !== undefined && committed.activeId !== expectedId) throw new Error('ChatGPT account changed')
      return structuredClone(grant)
      })
      refreshTail = operation.catch(() => {})
      return operation
    },
  })
}
