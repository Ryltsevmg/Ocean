/**
 * Remote access refusal explanation shared by every client surface that
 * reports a refused Remote call. The Gateway names a refusal in
 * `details.reason`: `scope:<name>` parts (several joined by `|`) for an action
 * that device scopes can grant, or `no-allow` when no device scope covers it.
 * Mapping is here so two surfaces report the same refusal with the same words;
 * the words stay in the `common` dictionary, per locale-owned copy.
 *
 * @module @ocean/ocean-client-ui-primitives/access-refusal
 */

import type { RemoteFailure } from '@ocean/ocean-typert-protocol'
// Type-only: the `remote-access/denied` entry of RemoteErrorDetailsMap.
import type {} from '@ocean/ocean-api-remote-access/types'

const SCOPE_PREFIX = 'scope:'

/** The `common` explanation of one Remote access refusal. */
export type AccessRefusalText =
  /** Device scopes list the action and the login holds none of them. */
  | { readonly key: 'remoteAccess.denied.scope'; readonly scope: string }
  /** No device scope lists the action: only the Host owner may take it. */
  | { readonly key: 'remoteAccess.denied.owner' }

/**
 * Explain one Remote access refusal through the `common` dictionary, so every
 * client surface reports a refused device call with the same words.
 * @param failure - the failure a Remote call returned.
 * @returns the dictionary key with the missing scope names when the Gateway
 *   names scopes, the owner-only explanation for `no-allow`, or `undefined`
 *   for any other failure or reason so the caller keeps its own diagnostic.
 */
export function accessRefusal(failure: RemoteFailure): AccessRefusalText | undefined {
  if (failure.code !== 'remote-access/denied') return undefined
  const scopes = failure.details.reason
    .split('|')
    .filter(part => part.startsWith(SCOPE_PREFIX))
    .map(part => part.slice(SCOPE_PREFIX.length))
  if (scopes.length > 0) return { key: 'remoteAccess.denied.scope', scope: scopes.join(', ') }
  if (failure.details.reason === 'no-allow') return { key: 'remoteAccess.denied.owner' }
  return undefined
}

/** A translator whose key domain holds the `common` vocabulary. */
export type AccessRefusalTranslate = (key: AccessRefusalText['key'], params?: Record<string, unknown>) => string

/**
 * Say one access refusal through a translator, in the `common` vocabulary.
 * @param refusal - the explanation `accessRefusal` answered.
 * @param t - translator whose key domain holds the `common` vocabulary.
 * @returns the localized explanation, naming the missing scopes or the Host owner.
 */
export function accessRefusalText(refusal: AccessRefusalText, t: AccessRefusalTranslate): string {
  return 'scope' in refusal ? t(refusal.key, { scope: refusal.scope }) : t(refusal.key)
}
