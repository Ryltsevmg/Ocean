/**
 * Test-only client roster of the assembled viewer page.
 *
 * A served viewer page is the owner's own Web shell with the owner's client plugins; this roster is the
 * subset the viewer page specs need: the wire plugin, the Gateway, remote access, the Session/Workspace controllers,
 * the menu service, presentation plugins, and the Liveshare `./client` face, which mounts the viewer surfaces when the
 * carrier names a share. Every row is the package's own `/client` face registered as a module-table
 * factory. It must be imported only after {@link prepareViewerRemoteFaces} answered the generated
 * `/remote` faces these plugins import.
 *
 * @module @ocean/ocean-experimental-liveshare/tests/viewer-page-roster
 */

import * as apiGateway from '@ocean/ocean-api-gateway/client'
import * as apiRemoteAccess from '@ocean/ocean-api-remote-access/client'
import * as apiRemotes from '@ocean/ocean-api-remotes/client'
import * as apiSessionController from '@ocean/ocean-api-session-controller/client'
import * as apiWorkspaceController from '@ocean/ocean-api-workspace-controller/client'
import * as clientConnection from '@ocean/ocean-client-connection/client'
import * as clientFileUpload from '@ocean/ocean-client-file-upload/client'
import * as clientLocale from '@ocean/ocean-client-locale/client'
import * as clientModules from '@ocean/ocean-client-modules/client'
import * as clientResources from '@ocean/ocean-client-resources/client'
import * as clientShortcuts from '@ocean/ocean-client-shortcuts/client'
import * as uiAttachment from '@ocean/ocean-client-ui-attachment/client'
import * as uiChat from '@ocean/ocean-client-ui-chat/client'
import * as uiContextMenu from '@ocean/ocean-client-ui-context-menu/client'
import * as uiConversation from '@ocean/ocean-client-ui-conversation/client'
import * as uiDeliverables from '@ocean/ocean-client-ui-deliverables/client'
import * as uiFileDrag from '@ocean/ocean-client-ui-file-drag/client'
import * as uiLayout from '@ocean/ocean-client-ui-layout/client'
import * as uiRenderer from '@ocean/ocean-client-ui-renderer/client'
import * as uiSession from '@ocean/ocean-client-ui-session/client'
import * as uiSettings from '@ocean/ocean-client-ui-settings/client'
import * as uiSidebar from '@ocean/ocean-client-ui-sidebar/client'
import * as uiSidebarRight from '@ocean/ocean-client-ui-sidebar-right/client'
import * as uiTheme from '@ocean/ocean-client-ui-theme/client'
import * as uiTool from '@ocean/ocean-client-ui-tool/client'
import * as uiTrajectory from '@ocean/ocean-client-ui-trajectory/client'
import * as uiWorkspace from '@ocean/ocean-client-ui-workspace/client'
import * as typertRegistry from '@ocean/ocean-typert-registry/client'
import * as liveshare from '../src/client/index.ts'

/** One module-table row: the entry id the Loader creates, and that plugin's client exports. */
export interface ViewerPageRosterRow {
  readonly id: string
  readonly exports: Readonly<Record<string, unknown>>
}

/** Entry id of the module-system bootstrap whose exports the facade hands to the module system. */
export const VIEWER_PAGE_BOOTSTRAP_ID = '@ocean/ocean-client-modules'

/** The viewer page roster; Cordis composes these entries by service injection, so order is irrelevant. */
export const VIEWER_PAGE_ROSTER: readonly ViewerPageRosterRow[] = [
  { id: '@ocean/ocean-typert-registry', exports: typertRegistry },
  { id: '@ocean/ocean-experimental-liveshare', exports: liveshare },
  { id: VIEWER_PAGE_BOOTSTRAP_ID, exports: clientModules },
  { id: '@ocean/ocean-client-connection', exports: clientConnection },
  { id: '@ocean/ocean-api-gateway', exports: apiGateway },
  { id: '@ocean/ocean-api-remote-access', exports: apiRemoteAccess },
  { id: '@ocean/ocean-api-remotes', exports: apiRemotes },
  { id: '@ocean/ocean-api-session-controller', exports: apiSessionController },
  { id: '@ocean/ocean-api-workspace-controller', exports: apiWorkspaceController },
  { id: '@ocean/ocean-client-file-upload', exports: clientFileUpload },
  { id: '@ocean/ocean-client-locale', exports: clientLocale },
  { id: '@ocean/ocean-client-resources', exports: clientResources },
  { id: '@ocean/ocean-client-shortcuts', exports: clientShortcuts },
  { id: '@ocean/ocean-client-ui-renderer', exports: uiRenderer },
  { id: '@ocean/ocean-client-ui-theme', exports: uiTheme },
  { id: '@ocean/ocean-client-ui-settings', exports: uiSettings },
  { id: '@ocean/ocean-client-ui-layout', exports: uiLayout },
  { id: '@ocean/ocean-client-ui-session', exports: uiSession },
  { id: '@ocean/ocean-client-ui-sidebar', exports: uiSidebar },
  { id: '@ocean/ocean-client-ui-conversation', exports: uiConversation },
  { id: '@ocean/ocean-client-ui-chat', exports: uiChat },
  { id: '@ocean/ocean-client-ui-context-menu', exports: uiContextMenu },
  { id: '@ocean/ocean-client-ui-tool', exports: uiTool },
  { id: '@ocean/ocean-client-ui-attachment', exports: uiAttachment },
  { id: '@ocean/ocean-client-ui-file-drag', exports: uiFileDrag },
  { id: '@ocean/ocean-client-ui-sidebar-right', exports: uiSidebarRight },
  { id: '@ocean/ocean-client-ui-trajectory', exports: uiTrajectory },
  { id: '@ocean/ocean-client-ui-deliverables', exports: uiDeliverables },
  { id: '@ocean/ocean-client-ui-workspace', exports: uiWorkspace },
]
