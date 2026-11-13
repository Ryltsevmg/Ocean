# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; read the mounted schema from `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) when available, otherwise from the package README. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-acp` | yes | Automation-only Agent Client Protocol server for driving Ocean agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@ocean/ocean-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@ocean/ocean-api-remote-access` | no | Method-level Remote access control for non-owner Peers and the per-Peer access snapshot |
| `@ocean/ocean-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@ocean/ocean-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@ocean/ocean-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@ocean/ocean-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@ocean/ocean-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@ocean/ocean-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-attachment-local` | yes | Private content-addressed DSH_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@ocean/ocean-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@ocean/ocean-plugin-manager` | yes | Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools |
| `@ocean/ocean-plugin-market` | yes | Configured plugin market indexes for the Web Discover page and the plugin_market agent tool |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-acp-app` | no | The dsh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over dsh-base |
| `@ocean/ocean-headless` | yes | The dsh one-shot bundle: a direct core Agent/Session runner over dsh-base with no Host, HTTP, or browser layer |
| `@ocean/ocean-sdk-app` | yes | The dsh SDK profile bundle: stdio JSON-RPC serving and process lifecycle over dsh-base |
| `@ocean/ocean-web-app` | yes | The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue plugin (frontend dist serving, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@ocean/ocean-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@ocean/ocean-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@ocean/ocean-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@ocean/ocean-client-modules` | no | Client module system, dual-face: node half composes the __DSH_BOOT__ entry graph (incremental dsh.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@ocean/ocean-client-product-analytics` | yes | Desktop product event collection and authenticated Host reporting |
| `@ocean/ocean-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@ocean/ocean-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@ocean/ocean-client-ui-account-notifications` | yes | Display account notifications and refresh localized content |
| `@ocean/ocean-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@ocean/ocean-client-ui-agent-team` | no | Web shared task board for a subagent tree |
| `@ocean/ocean-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@ocean/ocean-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@ocean/ocean-client-ui-brand-official` | no | Official Ocean brand artwork and click-triggered home background |
| `@ocean/ocean-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@ocean/ocean-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@ocean/ocean-client-ui-context-menu` | no | Typed, plugin-extensible context menus with captured targets and shared Web presentation |
| `@ocean/ocean-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@ocean/ocean-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@ocean/ocean-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@ocean/ocean-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@ocean/ocean-client-ui-entry-customization` | no | Customize plugin entries in the left sidebar, conversation views, and right sidebar, and quickly create new plugins. |
| `@ocean/ocean-client-ui-file-actions` | no | Original-file saving and image clipboard actions for Web and Desktop |
| `@ocean/ocean-client-ui-file-drag` | no | Application-owned file drag transfers and localized failure feedback |
| `@ocean/ocean-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@ocean/ocean-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@ocean/ocean-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@ocean/ocean-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@ocean/ocean-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@ocean/ocean-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@ocean/ocean-client-ui-open-in-app` | no | Session application submenus and native opening controls for directories and previewed files |
| `@ocean/ocean-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@ocean/ocean-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@ocean/ocean-client-ui-plugin-manager` | yes | Plugin management for the dsh web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@ocean/ocean-client-ui-plugin-market` | no | Discover tab of the dsh web Plugins page: browse configured plugin market indexes and install their bundles |
| `@ocean/ocean-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@ocean/ocean-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@ocean/ocean-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@ocean/ocean-client-ui-secret-mask` | no | Web display masking for recognized credentials in sent user text |
| `@ocean/ocean-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@ocean/ocean-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@ocean/ocean-client-ui-settings-account` | yes | Manage DeepSeek login and open Platform billing pages |
| `@ocean/ocean-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the dsh web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@ocean/ocean-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@ocean/ocean-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@ocean/ocean-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@ocean/ocean-client-ui-settings-plugins` | no | Built-in plugins settings section for the dsh web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@ocean/ocean-client-ui-settings-session-log` | no | General settings control for Session-log upload with DeepSeek API requests |
| `@ocean/ocean-client-ui-settings-shell` | no | Settings page of the shell executor on the dsh web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@ocean/ocean-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the dsh web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@ocean/ocean-client-ui-settings-web-search` | no | Settings page for web search and fetch on the dsh web client's Plugins page: the Search and Fetch provider menus, the DeepSeek Search API result count, DeepSeek Search and Fetch API billing, and legacy Messages search settings |
| `@ocean/ocean-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@ocean/ocean-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@ocean/ocean-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@ocean/ocean-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@ocean/ocean-client-ui-sidebar-files` | no | The workspace files page and one workspace directory tree per pane beside docked and floating file previews, listed lazily over the workspaceFiles Remote namespace |
| `@ocean/ocean-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@ocean/ocean-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@ocean/ocean-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@ocean/ocean-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@ocean/ocean-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; ThemeRuntime for light/dark/system state and icon replacements; --dsw-* token styles and Appearance settings row |
| `@ocean/ocean-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@ocean/ocean-client-ui-trajectory` | yes | Trajectory event ledger and timing overview with live tool-result inspection |
| `@ocean/ocean-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@ocean/ocean-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for dsh web |
| `@ocean/ocean-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@ocean/ocean-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the Ocean |
| `@ocean/ocean-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@ocean/ocean-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@ocean/ocean-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@ocean/ocean-harness-dev-context` | no | Model context naming the Ocean checkout and Web GUI URL without letting either change the system prompt |
| `@ocean/ocean-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@ocean/ocean-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@ocean/ocean-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the Ocean |
| `@ocean/ocean-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@ocean/ocean-agent-loop` | yes | The concrete agent loop plugin for the Ocean |
| `@ocean/ocean-agent-tool-presentation` | yes | Deprecated tool presentation selector; use dsh-tool-executor-native or dsh-tool-executor-ptc directly |
| `@ocean/ocean-session` | no | Event-sourced session store for the Ocean |
| `@ocean/ocean-system-prompt` | yes | System prompt assembly registry for the Ocean |
| `@ocean/ocean-tool-executor-native` | no | Native tool execution plugin |
| `@ocean/ocean-tool-executor-ptc` | yes | PTC program execution, tool bindings, and generated SDK prompts |
| `@ocean/ocean-tools` | no | Tool registry and execution pipeline for the Ocean |

## credentials

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@ocean/ocean-credentials-local` | yes | File-backed credentials provider ($DSH_HOME/.env under the live process environment) for the Ocean |
| `@ocean/ocean-deepseek-account` | yes | Sign in to DeepSeek and manage account credentials and notifications |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-deliverable-file-references` | no | Shared model guidance for file links and deliverables across Ocean hosts |
| `@ocean/ocean-tool-present` | yes | Explicit workspace file delivery declarations for the Ocean |
| `@ocean/ocean-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the Ocean |

## document

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-office-kit` | yes | Shared Office rendering, conversion, and recalculation with bounded queues and caching |
| `@ocean/ocean-tool-office` | yes | Model-facing Office tools for rendering, converting, and recalculating documents |

## experimental

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-action-cards` | yes | Optional action cards below answers: one shared proposal tool, card state, user actions and status notices |
| `@ocean/ocean-browser-use-browse` | yes | Optional session-owned control of an explicitly paired browse browser |
| `@ocean/ocean-client-ui-action-cards` | no | Action cards below completed answers: the shared card frame, kind bodies and the compact tool row |
| `@ocean/ocean-client-ui-creation-recommendations` | no | Body of the personalized page card: location choice, creation progress, Undo and Restore |
| `@ocean/ocean-client-ui-plugin-recommendations` | no | Official plugin card body with catalog text and enabling |
| `@ocean/ocean-creation-recommendations` | no | Create persistent removable interface plugins from explicit conversation needs |
| `@ocean/ocean-cua` | no | Shared Computer Use application objects, authorization, and logged tool execution |
| `@ocean/ocean-cua-linux` | yes | Experimental Linux AT-SPI semantic Computer Use without global input |
| `@ocean/ocean-cua-windows` | yes | Windows C# computer use through shared application and window objects |
| `@ocean/ocean-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@ocean/ocean-experimental-auto-review` | no | Per-tool LLM authorization review for the Ocean Auto permission preset |
| `@ocean/ocean-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@ocean/ocean-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@ocean/ocean-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@ocean/ocean-experimental-claude-code-mods` | yes | Experimental bridge: load Claude Code mods (hooks modules) and run their hook chains on Ocean extension points |
| `@ocean/ocean-experimental-client-ui-claude-code-mods` | no | Web band above the prompt for Claude Code mods: draws each session's mod tree and sends button presses back to the bridge |
| `@ocean/ocean-experimental-client-ui-cot-translation` | yes | Optional machine translation of expanded reasoning, preserving original Session text |
| `@ocean/ocean-experimental-client-ui-forge` | yes | Sidebar panel for a Session's change requests, with a worktree option for new Sessions and its Host Remote |
| `@ocean/ocean-experimental-client-ui-stats` | no | Per-turn and per-step context, timing, cache, and tool-cost table contributed as an experimental conversation View |
| `@ocean/ocean-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@ocean/ocean-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@ocean/ocean-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@ocean/ocean-experimental-cua-macos` | yes | macOS native provider for shared Computer Use application and window objects |
| `@ocean/ocean-experimental-forge` | yes | Provider-neutral change request registry with shared status polling |
| `@ocean/ocean-experimental-forge-github` | yes | GitHub provider for the experimental forge registry, read through the GitHub CLI on the host |
| `@ocean/ocean-experimental-forge-session` | yes | Binds change requests to the Session that created, pushed, or tracked them |
| `@ocean/ocean-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@ocean/ocean-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the Ocean PTC execution seam |
| `@ocean/ocean-experimental-session-inspector` | no | Experimental virtualized Session log and live Chat group/node inspectors |
| `@ocean/ocean-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@ocean/ocean-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@ocean/ocean-experimental-subagent-oar` | yes | Experimental one-shot subagents through OAR runtimes |
| `@ocean/ocean-experimental-tool-subagent-oar` | yes | Delegate standalone tasks to configured external subagent providers |
| `@ocean/ocean-experimental-tool-worktree` | no | Model tool that creates and enters a new Git worktree |
| `@ocean/ocean-experimental-translator` | yes | Machine translation with reusable Session results |
| `@ocean/ocean-experimental-worktree` | yes | Creates a named Git worktree and changes the calling Session working directory |
| `@ocean/ocean-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the Ocean interception seams |
| `@ocean/ocean-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the Ocean interception seams |
| `@ocean/ocean-plugin-recommendations` | no | Official plugin suggestions with explicit user activation and persistent conversation decisions |
| `@ocean/ocean-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for Ocean session titles |
| `@ocean/ocean-skill-badge` | no | Bundled dsh badge skill provider for Ocean |
| `@ocean/ocean-terminal-panel` | yes | Persistent Agent terminals shown in the Web sidebar, plus read-only access to the user's terminals |
| `@ocean/ocean-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@ocean/ocean-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |
| `@ocean/ocean-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |
| `@ocean/ocean-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed Ocean Sessions |
| `@ocean/ocean-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the Ocean webhook runtime |

## extensions

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@ocean/ocean-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@ocean/ocean-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@ocean/ocean-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@ocean/ocean-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-fs-local` | yes | Local-filesystem implementation of the Ocean filesystem seam (ctx.fs) |
| `@ocean/ocean-fs-observation-policy` | no | File-context policy plugin for the Ocean — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@ocean/ocean-fs-sandbox` | yes | Sandbox-enforcing implementation of the Ocean filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@ocean/ocean-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the Ocean filesystem seam (ctx.fs) |
| `@ocean/ocean-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@ocean/ocean-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@ocean/ocean-goal` | yes | Event-sourced same-session goal state and lifecycle service for the Ocean |
| `@ocean/ocean-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@ocean/ocean-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@ocean/ocean-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## host

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the Ocean web GUI host |
| `@ocean/ocean-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@ocean/ocean-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the Ocean web GUI host |
| `@ocean/ocean-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@ocean/ocean-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@ocean/ocean-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@ocean/ocean-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@ocean/ocean-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, per-Peer index transform taps, and static dist fallback |

## interaction

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-commands` | no | Plugin-owned human command registry for Ocean UIs |
| `@ocean/ocean-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the Ocean: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@ocean/ocean-tool-ask-user` | yes | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@ocean/ocean-user-approval` | yes | User-approval seam (ctx.approval) for the Ocean: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@ocean/ocean-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-jobs-local` | yes | Process-local implementation of the Ocean background job registry seam |
| `@ocean/ocean-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-deepseek-llm-api-extensions` | no | Additive request-field registry for the official DeepSeek LLM API adapter |
| `@ocean/ocean-llm` | no | Provider-neutral LLM service interface for the Ocean |
| `@ocean/ocean-llm-deepseek-account` | yes | DeepSeek account provider authentication and discovery |
| `@ocean/ocean-llm-deepseek-api-key` | yes | DeepSeek api-key provider authentication and discovery |
| `@ocean/ocean-llm-pi-ai` | yes | pi-ai-backed DeepSeek adapter for the Ocean LLM seam (design-verification twin of dsh-llm-deepseek) |
| `@ocean/ocean-llm-retry` | yes | Provider-routed LLM request retry policy for the Ocean |
| `@ocean/ocean-plugin-package-inventory-deepseek` | yes | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests |
| `@ocean/ocean-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the Ocean |

## lsp

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the Ocean — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@ocean/ocean-lsp-stdio` | yes | Generic stdio language-server provider for the Ocean LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@ocean/ocean-tool-lsp` | yes | Model-facing lsp tool over the Ocean LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@ocean/ocean-mcp-manager` | yes | MCP server manager: a settings-driven fleet of mcp-client instances with runtime status, restart, and probe |
| `@ocean/ocean-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## plan

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@ocean/ocean-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@ocean/ocean-persona` | yes | Composition-authored deployment persona section for the Ocean |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-ptc-runtime-node` | yes | Node PTC execution with async function, REPL, scoped REPL and VM Script evaluators and optional retained state |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-sandbox-local` | yes | Local process-sandbox backends for the Ocean sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@ocean/ocean-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-schedule` | yes | Host-wide durable reminders with shared management and delivery to existing or new Sessions |
| `@ocean/ocean-tool-schedule` | no | Model-facing scheduled task tools (schedule_create, schedule_list, schedule_view, schedule_edit) over the Host ctx.schedule service |

## sdk

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process Ocean SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-message-quotes` | no | Selected-text quotation and Markdown blockquote presentation |
| `@ocean/ocean-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@ocean/ocean-session-log-deepseek` | yes | Incremental lossless session-log request extension for the official DeepSeek LLM API |
| `@ocean/ocean-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the Ocean |
| `@ocean/ocean-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@ocean/ocean-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@ocean/ocean-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the Ocean |
| `@ocean/ocean-session-telemetry-otel` | yes | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests |
| `@ocean/ocean-session-title` | yes | Log-backed session title service and provider registry for the Ocean |
| `@ocean/ocean-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for Ocean session titles |
| `@ocean/ocean-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the Ocean |
| `@ocean/ocean-tool-working-directory` | no | Read and change the active Session working directory |
| `@ocean/ocean-working-directory` | yes | Session working directories with durable changes and model context |

## session-query

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-session-log-export` | yes | Web Session-log ZIP export and Session Markdown copy |
| `@ocean/ocean-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |

## settings

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-settings` | no | Abstract user-settings seam (ctx.settings) for the Ocean |

## shell

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-bash-local` | yes | Local-subprocess implementation of the Ocean bash executor seam |
| `@ocean/ocean-bash-sandbox` | yes | Sandbox-consuming implementation of the Ocean bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@ocean/ocean-pwsh-local` | yes | Local PowerShell implementation of the Ocean bash executor seam |
| `@ocean/ocean-pwsh-sandbox` | yes | Sandbox-consuming implementation of the Ocean PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@ocean/ocean-shell-env` | yes | Tool-independent managed DSH_* shell environment registry |
| `@ocean/ocean-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@ocean/ocean-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@ocean/ocean-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@ocean/ocean-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-skill` | yes | Agent skill provider registry for the Ocean |
| `@ocean/ocean-skill-filesystem` | yes | Local filesystem skill provider for the Ocean |
| `@ocean/ocean-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and Office operation guidance |
| `@ocean/ocean-tool-skill` | yes | Model-facing skill loading tool for the Ocean |
| `@ocean/ocean-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-spill-local` | yes | Local-filesystem implementation of the Ocean spill storage seam (private session-scoped files) |
| `@ocean/ocean-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@ocean/ocean-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@ocean/ocean-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@ocean/ocean-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the Ocean |
| `@ocean/ocean-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the Ocean |
| `@ocean/ocean-storage-json` | yes | JSON file KV storage backend for the Ocean storage hub |
| `@ocean/ocean-storage-sqlite` | yes | SQLite storage backend (kv facet) for the Ocean storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@ocean/ocean-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@ocean/ocean-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@ocean/ocean-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@ocean/ocean-subagent-dsh-sdk` | yes | Out-of-process SDK subagent backend: drives a child Ocean runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@ocean/ocean-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@ocean/ocean-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@ocean/ocean-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@ocean/ocean-tool-subagent-control` | yes | Shared messaging, interruption, and child discovery tools for subagents |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-subprocess-local` | no | Local-subprocess implementation of the Ocean subprocess seam |

## team

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-agent-team` | yes | Shared task DAG and change waits for subagent trees |
| `@ocean/ocean-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |

## telemetry

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-otel` | no | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels |

## terminal

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-terminal` | no | Persistent PTY session seam for the Ocean — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@ocean/ocean-terminal-bash` | yes | Persistent shell PTY backend over the Ocean subprocess terminal primitive |

## test-support

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-tool-todo` | yes | Model-facing todo_write tool over the Ocean event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the Ocean web capability seam (ctx.web) |
| `@ocean/ocean-web` | yes | Abstract web access capability seam (ctx.web) for the Ocean — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@ocean/ocean-web-deepseek-api` | yes | DeepSeek Search and Fetch API providers for the Ocean web capability seam (ctx.web) |
| `@ocean/ocean-web-fetch-http` | yes | Anonymous HTTP(S) fetch provider for the Ocean web capability seam (ctx.web) |
| `@ocean/ocean-web-search-deepseek` | yes | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the Ocean web capability seam (ctx.web) |

## workflow

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@ocean/ocean-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@ocean/ocean-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the Ocean |
