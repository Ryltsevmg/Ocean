/** Remote failure text for the Workspace surfaces. */
import { accessRefusal, accessRefusalText } from '@ocean/ocean-client-ui-primitives'
import type { RemoteFailure } from '@ocean/ocean-typert-protocol'
import type { WorkspaceBrowserProps } from './contract/slots.ts'

/**
 * Explain one Remote failure for display: a device access refusal in the
 * shared `common` words, any other failure by its own diagnostic message.
 * @param failure - the failure a Remote call or stream reported.
 * @param t - the surface's locale seat; the `common` vocabulary is in its key domain.
 * @returns the localized access refusal, or the failure's own message.
 */
export function remoteFailureText(failure: RemoteFailure, t: WorkspaceBrowserProps['t']): string {
  const refusal = accessRefusal(failure)
  if (refusal === undefined) return failure.message
  return accessRefusalText(refusal, t)
}
