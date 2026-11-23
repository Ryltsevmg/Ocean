/** Remote actions that each device scope allows on every resource. */
import type { DeviceScope } from '@ocean/ocean-client-connection'
import type { RemoteAccessAction } from '@ocean/ocean-api-remote-access'

/**
 * The actions of each scope. A device holds the union of its scopes; a device created
 * before scopes holds every scope, which equals the single set earlier releases allowed.
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
  ],
  'files:read': [
    'workspaceFiles/list', 'workspaceFiles/read', 'workspaceFiles/readBytes', 'workspaceFiles/stat',
    'workspaceFiles/search', 'workspaceFiles/changes', 'directoryPicker/list', 'workspace/follow',
  ],
  'files:write': ['fileUploads/upload', 'workspace/create', 'workspace/initializeDefault'],
  'terminal:operate': ['terminal/list', 'terminal/create', 'terminal/close', 'terminal/attach'],
  'settings:manage': [
    'settings/describe', 'settings/update', 'settings/replace', 'settings/mutate', 'event:settings/document-updated',
    'credentials/describe', 'credentials/set', 'credentials/unset', 'event:credentials/reference-updated',
    'llm/listProviders', 'llm/listConfigurableProviders',
  ],
}

/**
 * Collect the actions of a device's scopes.
 * @param scopes - Rights the device holds.
 * @returns The union of their actions.
 */
export function actionsOfScopes(scopes: readonly DeviceScope[]): ReadonlySet<RemoteAccessAction> {
  return new Set(scopes.flatMap(scope => DEVICE_SCOPE_ACTIONS[scope]))
}
