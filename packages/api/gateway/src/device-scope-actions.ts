/** Remote actions that each device scope allows on every resource. */
import type { DeviceScope } from '@ocean/ocean-client-connection'
import type { RemoteAccessAction } from '@ocean/ocean-api-remote-access'

/**
 * The actions of each scope. A device holds the union of its scopes; a device created
 * before scopes holds every scope.
 */
export const DEVICE_SCOPE_ACTIONS: Readonly<Record<DeviceScope, readonly RemoteAccessAction[]>> = {
  'sessions:read': [
    'session/list', 'session/search', 'session/page', 'session/events', 'session/follow', 'session/state', 'session/wait',
    'session/attachment', 'session/observeEvent', 'session/observeState', 'session/observeProjections', 'session/projections',
    'session/modelCatalog',
    'event:api-session/activity', 'event:api-session/added', 'event:api-session/error',
    'event:api-session/removed', 'event:api-session/status',
  ],
  'sessions:write': [
    'session/create', 'session/rename', 'session/prompt', 'session/cancel', 'session/control', 'session/selectModel',
    'session/initializeDefaultModel', 'userQuestions/attachWait', 'userQuestions/answer',
    'session/fork', 'session/updateQueue', 'workspace/rename', 'workspace/delete', 'workspace/insertBefore',
    'workspace/insertSessionBefore', 'workspace/archiveSession', 'workspace/unarchiveSession',
    'workspace/pinSession', 'workspace/unpinSession',
  ],
  'files:read': [
    'workspaceFiles/list', 'workspaceFiles/read', 'workspaceFiles/readBytes', 'workspaceFiles/stat',
    'workspaceFiles/search', 'workspaceFiles/changes', 'directoryPicker/list', 'workspace/follow',
    'officeKit/render', 'officeKit/generation',
  ],
  'files:write': [
    'fileUploads/upload', 'workspace/create', 'workspace/initializeDefault', 'directoryPicker/createDirectory',
  ],
  'terminal:operate': [
    'terminal/list', 'terminal/create', 'terminal/close', 'terminal/attach', 'portForward/open',
    'terminal/environment', 'terminal/shells', 'terminal/watch', 'terminal/retain', 'terminal/rename',
  ],
  'settings:manage': [
    'settings/describe', 'settings/update', 'settings/replace', 'settings/mutate', 'event:settings/document-updated',
    'credentials/describe', 'credentials/set', 'credentials/unset', 'event:credentials/reference-updated',
    'llm/listProviders', 'llm/listConfigurableProviders',
    'llm/discoverModels', 'permissionPresets/catalog', 'event:llm/adapters-updated', 'event:credentials/record-updated',
  ],
}

/**
 * Name the scopes that list `action`, for the reason a refused device call reports.
 * @param action - the refused Remote endpoint or `event:<name>`.
 * @returns `scope:<name>` for every scope listing the action, several joined by `|` in
 *   declaration order; `undefined` when no scope lists it, which leaves `no-allow`.
 */
export function scopeRefusalReason(action: RemoteAccessAction): string | undefined {
  const scopes = Object.entries(DEVICE_SCOPE_ACTIONS)
    .filter(([, actions]) => actions.includes(action))
    .map(([scope]) => `scope:${scope}`)
  return scopes.length === 0 ? undefined : scopes.join('|')
}

/**
 * Collect the actions of a device's scopes.
 * @param scopes - Rights the device holds.
 * @returns The union of their actions.
 */
export function actionsOfScopes(scopes: readonly DeviceScope[]): ReadonlySet<RemoteAccessAction> {
  return new Set(scopes.flatMap(scope => DEVICE_SCOPE_ACTIONS[scope]))
}
