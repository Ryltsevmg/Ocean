/** The package names the plugin manager protects, hides, orders, or marks experimental. */

/**
 * Plugin packages the plugin manager refuses to disable or remove, because management itself needs them; a bundle that
 * contains one is read-only as well. Removing a name drops only this `management-required` refusal; the manager's own
 * entry, installation-carried bundles, and unaddressable rows stay protected by their own rules.
 */
export const PROTECTED_PLUGINS: ReadonlySet<string> = new Set([
  '@ocean/ocean-plugin-manager', '@deepseek-ai/cordis-plugin-loader',
  '@deepseek-ai/cordis-plugin-include', '@ocean/ocean-api-gateway',
  '@ocean/ocean-host-webserver', '@ocean/ocean-client-modules',
  '@ocean/ocean-client-ui-settings-plugin-inventory', '@ocean/ocean-client-ui-plugin-manager',
  '@ocean/ocean-host-plugin-inventory', '@ocean/ocean-typert-registry',
  '@ocean/ocean-api-remotes', '@ocean/ocean-api-remote-access',
  '@deepseek-ai/cordis-plugin-timer', '@ocean/ocean-client-connection',
  '@ocean/ocean-host-frontend-static', '@ocean/ocean-tools',
  '@ocean/ocean-hmr',
])

/**
 * Built-in profile bundles, persistent terminals, and the standalone worktree tool, which have no plugin manager page.
 * Their Host availability and activation stay intact.
 */
export const HIDDEN_BUNDLES: ReadonlySet<string> = new Set([
  '@ocean/ocean-base',
  '@ocean/ocean-web-app',
  '@ocean/ocean-headless',
  '@ocean/ocean-sdk-app',
  '@ocean/ocean-acp-app',
  '@ocean/ocean-sdk-minimal',
  '@ocean/ocean-experimental-terminal-bundle',
  '@ocean/ocean-experimental-tool-worktree',
])

/**
 * The optional bundles the plugin manager's main and More lists rank first, in this order. {@link MORE_BUNDLES}, not
 * this list, decides whether a bundle appears on the main list.
 */
export const EXTENSION_BUNDLES: readonly string[] = [
  '@ocean/ocean-experimental-voice-input-bundle',
  '@ocean/ocean-experimental-plugin-market-bundle',
  '@ocean/ocean-experimental-auto-review',
]

/**
 * The optional bundles the plugin manager's main list leaves out until the profile enables them; its More list,
 * which includes every eligible bundle, ranks them last in this order.
 */
export const MORE_BUNDLES: readonly string[] = [
  '@ocean/ocean-browser-use-browse',
  '@ocean/ocean-personalized-recommendations',
  '@ocean/ocean-experimental-inspector-profile',
  '@ocean/ocean-cua-bundle',
  '@ocean/ocean-experimental-cot-translation-bundle',
  '@ocean/ocean-experimental-session-search',
  '@ocean/ocean-experimental-session-titles-bundle',
  '@ocean/ocean-experimental-badge-skill-bundle',
  '@ocean/ocean-experimental-ralph-bundle',
  '@ocean/ocean-subagent-codex',
  '@ocean/ocean-subagent-claude-code',
]

/** Official bundles the plugin manager marks with the Experimental badge. */
export const EXPERIMENTAL_BUNDLES: ReadonlySet<string> = new Set([
  '@ocean/ocean-browser-use-browse',
  '@ocean/ocean-personalized-recommendations',
  '@ocean/ocean-cua-bundle',
  '@ocean/ocean-experimental-voice-input-bundle',
  '@ocean/ocean-experimental-auto-review',
  '@ocean/ocean-experimental-inspector-profile',
  '@ocean/ocean-experimental-forge-bundle',
  '@ocean/ocean-experimental-tool-worktree',
  '@ocean/ocean-experimental-cot-translation-bundle',
  '@ocean/ocean-experimental-session-search',
  '@ocean/ocean-experimental-session-titles-bundle',
  '@ocean/ocean-experimental-badge-skill-bundle',
  '@ocean/ocean-experimental-ralph-bundle',
  '@ocean/ocean-experimental-plugin-market-bundle',
  '@ocean/ocean-experimental-liveshare',
])
