/** Host identity persisted with the credential home and a per-launch epoch. */
import { randomUUID } from 'node:crypto'
import { credentialKey, type CredentialProvider } from '@ocean/ocean-credentials'
import { z } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import type { HostId, HostEpoch } from './connect-protocol.ts'
import { connectionLaunch } from './launch-identity.ts'

const key = credentialKey('client-connection', 'device-host-identity')
const stored = z.object({ version: z.literal(1), hostId: z.uuid() })

/**
 * Read or initialize the identity and reuse the launch epoch across plugin reloads.
 * @param credentials - Provider shared with the device registry.
 * @param root - Launcher root whose lifetime defines the epoch.
 * @returns Stable credential-home identity and current launch epoch.
 */
export async function loadDeviceHostIdentity(
  credentials: CredentialProvider, root: Context,
): Promise<{ hostId: HostId; epoch: HostEpoch }> {
  const candidate = randomUUID()
  const record = await credentials.modifyRecord(key, current => Promise.resolve(current === undefined
    ? { kind: 'grant', payload: { version: 1, hostId: candidate } }
    : undefined))
  const result = stored.safeParse(record?.kind === 'grant' ? record.payload : null)
  if (!result.success) throw new Error('client-connection: missing or invalid device Host identity')
  return { hostId: result.data.hostId as HostId, epoch: connectionLaunch(root).epoch }
}
