# `@ocean/ocean`

English | [中文](README.zh.md)

The `ocean` command is the sole supported Node application launcher: profiles are ordered stacks of plugin-bundle patch layers under the user's own overrides. SDK and ACP are profiles, not separate public bins. The Python runtime wheel packages this same command; the SDK defaults to `sdk`, and the minimal example selects `sdk-minimal`. [`src/args.ts`](src/args.ts) owns the command grammar, and [`src/bin.ts`](src/bin.ts) loads only the selected runner. Invalid commands, options from another mode, and fatal configuration or boot failures exit nonzero.

## Entry modes

| Command | Purpose |
|---|---|
| `ocean <name>` / `ocean --profile <name>` | Boot the named profile under `$OCEAN_HOME/profiles/<name>`. |
| `ocean --profile <name> --from-default-profile <template>` | Replace a custom profile with a fresh copy of a shipped template, then boot it. |
| `ocean --profile acp` | Serve automation clients over ACP stdio until disconnect. |
| `ocean --profile headless "job"` | Run one fresh persisted session, print the final answer, and exit. |
| `ocean --profile sdk` | Serve SDK clients over JSON-RPC stdio until shutdown or disconnect. |
| `ocean --profile sdk-minimal` | Serve SDK clients with the standalone minimal agent tree. |
| `ocean web` | Boot the Web profile. |
| `ocean serve` | Run a Host for remote devices. |
| `ocean connect` | Send a command to a remote Host. |
| `ocean remote-device` | Bootstrap local device credentials or administer them over a running Host’s Unix socket. |
| `ocean plugin --profile <name> <pnpm args>` | Manage a profile's plugins by forwarding to pnpm in the profile directory. |

The invoking directory is the default workspace root. The `web`, `serve`, `connect`, `remote-device`, `headless`, `sdk`, `sdk-minimal`, and `acp` profiles auto-initialize on first use from shipped templates. Create or reset another profile at a non-shipped name with `--from-default-profile`, or initialize a base-backed profile through `ocean plugin`. The `desktop` name is reserved for the Electron-owned profile, so the CLI rejects boot and config-dump requests for it. The npm CLI also rejects its plugin-management requests; the [Desktop-installed command](../desktop/README.md#bundled-command-runtime) can manage the initialized Desktop profile using that installation’s runtime.

The `serve` profile runs the Web Host without opening a browser or watching configuration. Its readiness line carries a clean URL. A non-loopback listener requires TLS. Sign in with a device token in the browser, in Desktop’s **Connect to remote Host** dialog, or through `ocean connect`. The profile refuses legacy owner credentials.

For native TLS, pass `--tls-cert` with the PEM chain and `--tls-key` with its key. When an HTTPS reverse proxy terminates TLS, bind Ocean to loopback and pass the external HTTPS root as `--public-url` and its hostname as `--trusted-host`. Configure the proxy to preserve the public Host authority, forward WebSocket upgrades, and strip the external mount prefix before forwarding requests to Ocean. Clients use the public URL, including its mount path. See [deploying a remote Host](../../docs/cookbook/deploying-remote-host.md) for service, container, and recovery procedures.

On Windows, macOS, and Linux, run `ocean remote-device --bootstrap create <label>` under the Host’s service account with the same `OCEAN_HOME` to create a device without starting a listener. Use `ocean remote-device --bootstrap list` to inspect device metadata without printing tokens. A running Host observes the credential update through its file watcher; a credential provider with `watch: false` needs a reload. Bootstrap supports only create and list; rotate and revoke require the active Unix administrator socket. Choose exactly one of `--bootstrap` and `--socket`. The `--timeout` option bounds socket operations only.

On Unix, start the Host with `ocean serve --device-admin-socket /absolute/private-dir/admin.sock`. The directory must already exist and be accessible only to the server user. Run `ocean remote-device --socket /absolute/private-dir/admin.sock create <label>`, or use `list`, `rotate <id>`, and `revoke <id>`. Create and rotate print a bearer secret to stdout. Send it directly to the intended client and keep it out of logs.

Run `ocean connect --url https://host.example --token-env OCEAN_DEVICE_TOKEN list` to print remote Session summaries as JSON. Set the named environment variable before launch, or use `--token-stdin` with a pipe or redirected input. The client uses normal TLS certificate verification and owns a temporary in-memory login for the command.

The same client supports `create [--cwd <host-path>]`, `history <session-id>`, `prompt <session-id> <text> [--steer]`, `state <session-id>`, `wait <session-id>`, and `cancel <session-id>`. Prompt writes its request ID to stderr before submission and includes it in the diagnostic if the result is unknown. Use `--request-id <uuid>` only to retry the same prompt. For other commands that change state, inspect the session before retrying an unknown result.

Use `approvals <session-id>` to list pending tool approvals and `approve <session-id> <approval-id> <allow-or-deny>` to answer one. A response with `accepted: false` means the request is no longer pending for that session. Pending approvals with a Host deadline include `expiresAt` in Unix milliseconds.

Use `questions <session-id>` to list live questions. Send a structured answer with `answer-question <session-id> <question-request-id> <answer-json>`. For example, `{"answers":[{"id":"q1","selected":["Remote"]}]}` selects an offered option. A free-text answer uses an empty `selected` array and a `custom` string. For a question whose foreground timer ended, use `questions <session-id> --continued` to find its `callId`. Pass that ID to `answer-question` with `--continued`.

Use `files <session-id> [path]` to list a Host workspace directory. Use `read <session-id> <path> [--offset <line>] [--limit <lines>]` to read a text page. Relative paths resolve against the Session’s workspace on the Host.

Use `upload <session-id> <local-path>` to stream a local file and receive its attachment receipt as JSON. Pass the returned `receiptId` to `prompt <session-id> <text> --file <receipt-id>` for the same session.

Use `terminals <session-id>` to list Host terminals, `terminal-create <session-id> [--id <id>]` to start a Host shell, and `terminal-close <session-id> <terminal-id>` to stop it. Create prints the terminal ID before sending the request so the same identity can be used if its reply is lost.

Use `terminal-watch <session-id> <terminal-id>` to stream a retained terminal’s screen and subsequent frames as JSON lines. After a transport failure it checks the existing login and retries with backoff. The next snapshot replaces the previous screen. A changed Host or launch epoch ends the watch.

Use `terminal-write <session-id> <terminal-id> <text>` to send one input and wait for the Host to acknowledge it. Include a newline in the text when the shell should execute the line. If the connection drops after submission, inspect the terminal before sending the input again.

Use `follow <session-id>` to stream a JSON Lines history snapshot and subsequent events. After a connection interruption a fresh bounded snapshot replaces the previous baseline. If the Host rejects the login during recovery, the command exits and asks for an active device token. Use `history <session-id> --before-seq <seq>` to request older history before the first event in the current page.

## App arguments

The launcher parses only its own flags and hands everything after them to the booted profile, where any injected app plugin may parse the shared immutable snapshot ([`ocean-cmdline`](../../packages/boot/cmdline/README.md)). The first token the launcher does not recognize starts the app's arguments:

```sh
ocean --profile web --port 8080       # --port belongs to the web app
ocean --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
ocean --profile headless "run the tests"
ocean --profile web --help            # the web app's flags, not the launcher's
ocean --help                          # the launcher's own help
```

<a id="profiles"></a>
## Profiles

A profile directory holds a `package.json` (out-of-tree plugin dependencies plus the profile manifest `ocean.profile` with its ordered `bundles` list) and a `cordis.patch.yml` (the user's own patch layer). `ocean-hmr`, when enabled in YAML, watches the profile manifest and both profile and home patch files, then recomposes all layers through one serialized reload. Without HMR, changes apply on restart. Edits arriving during watcher registration use the same nonfatal reload reporting as later edits. [Plugin Manager](../../packages/boot/plugin-manager/README.md) shares package operations and the profile write lock with `ocean plugin`; package updates retain disabled bundle selections. CLI package commands inherit authentication variables and terminal descriptors, including interactive build approval; service calls retain their scrubbed environment and captured diagnostics.

Installation and profile startup enforce the declared `engines.ocean` range, or OCEAN peer ranges when it is absent, against the same runtime version shown by `ocean --version`. Incompatible plugins require an explicitly acknowledged exact-version exemption. The [plugin manager's compatibility reference](../../packages/boot/plugin-manager/README.md#version-compatibility-and-exemptions) documents `version-exemptions`, `allow-version`, `revoke-version`, persistence, and risks.

The tree composes over an empty root:
- each bundle's patch in `ocean.profile.bundles` order
- then the profile's `cordis.patch.yml`, then the home-level `$OCEAN_HOME/cordis.patch.yml`
- then `--patch` overlays

Bundles named in `ocean.profile.bundles` resolve from the ocean installation first (`@ocean/ocean-base`, `@ocean/ocean-web-app`, `@ocean/ocean-headless`, `@ocean/ocean-sdk-app`, `@ocean/ocean-sdk-minimal`, `@ocean/ocean-acp-app`), then from the profile's own `node_modules`, where pnpm installs out-of-tree plugins.

Use `--dump-default-config` and `--dump-config` to inspect the composed tree without booting it. `--dump-config-schema` imports the composed tree's declared plugin schemas and prints JSON Schema for entries and patches instead of configuration values; read the [schema-dump safety and scope](reference/README.md#config-schema-dump) before inspecting untrusted plugins.

The [CLI behavior reference](reference/README.md) owns exact layer precedence, flags, shutdown behavior, deployment defaults, and source execution. The [startup and reload failure table](../../packages/boot/app-boot/README.md#startup-and-reload-failures) compares optional and required plugin failures with configuration HMR.

## Optional overlays

`config/examples/` ships opt-in overlays for GitHub review webhooks, memory MCP servers, and runtime Cordis tools. They are never part of a default profile; the [user guides](../../docs/user/guide/index.md) and [developer practice guides](../../docs/user/develop/practice/index.md) own setup and safety instructions.

## Installed payload

The published tarball carries the bundled runtime under `lib/`, the TypeScript under `src/`, the declaration and JavaScript maps beside the files they describe, and the documentation under `docs/`. Only `prepack` stages `docs/`, and `postpack` removes that copy again, so a reader of the working tree sees whatever the checkout holds.

`docs/` holds the documentation website's pages plus every upgrade guide, with the assets those pages reference. `docs/upgrade-guide/README.md` is generated during staging: it groups the guides by the release each `v<T>` directory upgrades from and lists each guide's title, English and Chinese descriptions, and relative paths. The Desktop application carries the same `docs/` and `src/` in its packaged ocean runtime: `resources/ocean` outside ASAR on Linux, and `resources/app.asar/ocean` on macOS and Windows. The generated `persistence-changes/` records, the `i18n/` guidelines, and the `*.i18n.yaml` consistency records are not published. Its pages keep the repository's relative links, so a link into `../packages/**` or into the omitted `persistence-changes/` records resolves only in a checkout.

## Development

Production runs require built package and frontend artifacts. From the repository root, run `pnpm run build` separately, then use `pnpm ocean <args...>` to run the TypeScript entry and forward every argument; the [source-execution reference](reference/README.md#source-execution) owns the module-resolution contract.

The `@ocean/ocean/profile-boot` export provides the shared profile lifecycle to the Desktop host. A resolved application profile supplies its own installation anchor for runtime package resolution while retaining the Harness home patch, proxy environment, telemetry switch, patch reload, and bounded shutdown.

Packaged installations call the same `runCli()` entry with their package-manager executable. The Desktop carrier also enables plugin operations for its initialized profile; npm launches omit these options. Installation-owned package environments apply only to plugin package operations; the invoking directory, ordinary profile selection, and agent-shell PATH retain their CLI meanings.

The [Web failure matrix](tests/profiles/web/tests/web-failure-matrix.expected.e2e.ts) runs the built CLI through startup failures and native configuration HMR with `awaitWriteFinish` enabled in `test:expected`. It verifies authenticated HTTP responses, diagnostics, recovery, process exits, and disposal without model API calls; the [startup acceptance](tests/profiles/web/tests/web-best-effort-startup.expected.e2e.ts) also covers the shipped required Web dependencies and port conflicts.
