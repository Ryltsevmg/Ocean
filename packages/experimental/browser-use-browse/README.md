---
description: "Opt-in control of agent-owned tabs in an existing Chromium profile through a local browse relay."
kind: "package-bundle"
---

# @ocean/ocean-browser-use-browse

English | [中文](README.zh.md)

## Summary

Optional browser provider for Ocean, targeting **anomalyco/browse v0.0.16**. It controls agent-owned tabs in the user's existing paired Chromium profile, with that profile's existing logins. It does not launch a blank browser or isolate accounts/cookies.

## Table of Contents

- [Use this package](#use-this-package)
- [Tools and lifecycle](#tools-and-lifecycle)
- [Upstream](#upstream)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

## Use this package

The plugin is disabled by default and absent from shipped compositions. Install and pair upstream browse only after the user approves its extension permissions. This package never installs an extension, starts a relay, changes another client's configuration, or enables upstream automatic updates. Use a separately managed local relay with automatic updates disabled for a reproducible pilot. Version mismatch fails closed.

The optional bundle adds the browser registry, stable setup service and disabled provider through [its profile patch](cordis.patch.yml). Use the human-facing setup panel or a reviewed profile override for `browser-use-browse`; loading the bundle does not connect or enable the provider. Review [the setup details](docs/DETAIL.md) before supplying credentials or allowing tools.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `false` | Explicitly allow browser tools after reviewing connection settings |
| `endpoint` | `http://127.0.0.1:19988` | Local relay, never a remote server |
| `tokenFile`, `browser` | Empty | Private token file path and explicitly paired browser ID |
| `allowedOrigins` | `[]` | Exact approved public HTTPS origins |
| `timeoutMs`, `handoffTimeoutMs` | `30000`, `300000` | Operation and human-handoff budgets |
| `maxResponseBytes` | `262144` | Maximum relay response bytes |

The token file must be a regular, non-symlink file owned by the current user with no group/other permissions. The plugin reads it without printing or copying it. Endpoint, browser id and origins are profile-owned, never model arguments. Only explicit public HTTPS origins are accepted in this MVP. The relay's **navigation** allowlist is not network egress isolation: pages may load third-party subresources.

## Tools and lifecycle

`ocean_browser_navigate`, `snapshot`, `click`, `fill` and `handoff` use narrow argument schemas and fixed upstream source. The plugin does not expose arbitrary JavaScript, upstream session selection, settings, secret profiles, recording, network capture or user-tab adoption. The normal Ocean tool pipeline remains responsible for required action confirmations. `fill` is for ordinary text; sensitive input belongs to the person via handoff. Password/autocomplete-sensitive inputs are additionally refused, but field detection is not a general secret detector.

A live Ocean Agent lazily receives a new random browser-session id. Calls serialize per owner, including subagents; no tool accepts a session id. Two owners cannot select each other's tabs through this provider. A new activation after resume receives fresh tab state. Browser profile logins remain shared. Unloading the provider or disposing an owner deletes only its owned relay session, not the browser or relay.

A timeout, cancellation or untrusted response poisons that connection. The action may already have happened; the provider never retries it. Failed acquisition is retained as a tombstone for that live Agent. Inspect the browser before starting another Ocean session. Cleanup failures are reported rather than claimed successful. Handoff has a separate bounded human-wait budget; expiration leaves the result uncertain, not reverted. Browser actions already delivered cannot be undone by cancellation.

Cleanup failure blocks replacement browser authority for the rest of the Host lifetime. The Host root owns this failure state independently of the optional setup and provider, so disabling and re-enabling the bundle does not clear it. Setup disposal awaits cleanup; Host shutdown removes the state service without preventing pending cleanup from recording failure. Independent Hosts do not share this state.

## Upstream

Protocol references: [browse v0.0.16](https://github.com/anomalyco/browse/tree/v0.0.16), especially `cli/src/relay/client.ts`, `schema.ts` and `secrets.ts`. See `THIRD_PARTY_NOTICES` for MIT attribution. No upstream runtime is copied into this package.

## Model Experience

### Browser operations and guidance

#### What the model sees

When enabled, `ocean_browser_navigate`, `ocean_browser_snapshot`, `ocean_browser_click`, `ocean_browser_fill` and `ocean_browser_handoff` provide narrow operations and browser guidance. Outputs contain bounded page text and upstream warning/challenge summaries through ordinary logged tool results. Page content is untrusted data, not instructions or permission. No independent inference provider is used.

#### Token effect

Five tool definitions, one guidance section and bounded tool results consume model context while enabled.

#### KV Cache effect

Enabling or disabling the provider changes tool definitions and one prompt section. Each result enters the owning Session log; browser state is not reconstructed from it.

## Known Limitations and Deferred Work

- This is an experimental adapter, not a shipped extension or completed installer. Verification uses a fake relay and real Ocean Loader/tool loop; a real paired-browser pilot and UI acceptance remain required. POSIX private-file checks are currently targeted at Linux/macOS; Windows token ACL qualification is deferred.

- The upstream HTTP API is private and version-gated. Same-version source changes or build origin are not authenticated by a version string. The user must install a trusted build and pair the intended browser. Local processes under the same user and other clients of that relay are outside this plugin's isolation. After a hard Host crash/OOM, upstream may retain orphan sessions/tabs; automatic crash cleanup is **not** promised. Inspect and remove those through the user-controlled upstream interface.

- Remote relays, file/local-network origins, arbitrary JS, user-tab adoption, shared sessions, secrets, recordings, auto-update, pairing UI and crash recovery are tracked in Linear RMG-334. No browser permissions were granted by developing this package.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
