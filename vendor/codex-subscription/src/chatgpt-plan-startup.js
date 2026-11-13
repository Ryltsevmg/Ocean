/** Restore the saved account's model catalog without starting authentication. */
export async function restorePlanCatalog(service, { signal }) {
  signal?.throwIfAborted()
  const status = await service.status()
  signal?.throwIfAborted()
  const account = status.accounts.find(entry => entry.id === status.activeId)
  if (!account || account.signedOut || account.reauthorizationRequired) return undefined
  return service.models({ signal })
}
