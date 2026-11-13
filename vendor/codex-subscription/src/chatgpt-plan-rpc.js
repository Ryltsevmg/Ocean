/** Client-safe commands for the independently owned ChatGPT plan flow. */
import { assertCodexAuthUrl } from './external-url.js'

/** Return fixed public failures without exposing credentials. @param {object} options - Host service and browser opener. @returns {Function} The client-safe RPC handler. */
export function createPlanRpcHandler({ service, openExternal }) {
  const ok = value => ({ ok: true, value })
  const fail = message => ({ ok: false, error: { code: 'unavailable', message, details: { issues: [] } } })
  return async (endpoint, payload, signal) => {
    signal?.throwIfAborted()
    try {
      if (endpoint === 'plan/status') return ok(await service.status())
      if (endpoint === 'plan/login/start') {
        if (typeof payload?.label !== 'string' || !payload.label.trim() || payload.label.length > 48) return fail('Invalid account label')
        if (payload.renewId !== undefined && (typeof payload.renewId !== 'string' || !/^[\w-]{1,128}$/u.test(payload.renewId))) return fail('Invalid account identifier')
        const result = await service.start(payload.label.trim(), { renewId: payload.renewId })
        try {
          signal?.throwIfAborted()
          await openExternal(assertCodexAuthUrl(result.url))
          return ok(await service.status())
        } catch (error) {
          await service.cancel()
          throw error
        }
      }
      if (endpoint === 'plan/login/cancel') { await service.cancel(); return ok(await service.status()) }
      if (endpoint === 'plan/account/select') {
        if (typeof payload?.id !== 'string' || !/^[\w-]{1,128}$/u.test(payload.id)) return fail('Invalid account identifier')
        await service.select(payload.id)
        return ok(await service.status())
      }
      if (endpoint === 'plan/account/sign-out') { if (typeof payload?.id !== 'string' || !/^[\w-]{1,128}$/u.test(payload.id)) return fail('Invalid account identifier'); const result = await service.signOut(payload.id); return ok({ ...(await service.status()), ...result }) }
      if (endpoint === 'plan/account/recover-sign-out') { if (payload?.confirm !== true || typeof payload?.id !== 'string' || !/^[\w-]{1,128}$/u.test(payload.id)) return fail('Invalid recovery confirmation'); const result = await service.recoverSignOut(payload.id); return ok({ ...(await service.status()), ...result }) }
      if (endpoint === 'plan/models') return ok(await service.models({ signal }))
      return fail('ChatGPT plan operation unavailable')
    } catch (error) {
      if (signal?.aborted) throw error
      return fail('ChatGPT plan operation failed')
    }
  }
}
