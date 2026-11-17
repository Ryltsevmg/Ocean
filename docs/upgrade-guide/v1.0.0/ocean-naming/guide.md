---
kind: upgrade-guide
description: Ocean commands, environment variables, and plugin metadata replace the DSH names.
---

# Ocean names

English | [中文](guide.zh.md)

## Change

The preferred CLI command is `ocean`; `dsh` remains an alias. Environment variables use `OCEAN_`, and plugin manifests use `ocean` and `engines.ocean`. The default home remains `~/.ocean`. TypeScript identifiers containing `Dsh` now contain `Ocean`; the subagent SDK package is `@ocean/ocean-subagent-ocean-sdk`. Desktop links use `ocean://`; `dsh://open` remains accepted. Internal resource URI schemes, browser storage keys, authentication cookies, legacy projection directories, ownership markers, and cross-version locks retain their existing identifiers.

Legacy `dsh` manifest metadata, `engines.dsh`, inherited `DSH_*` launcher variables, and SDK `dshBin`/`dshHome` options remain accepted when their Ocean equivalents are absent. Explicit Ocean values take precedence. Legacy home-path exports remain available for installed plugins.

Historical Session generations are unchanged. DeepSeek request fields `dsh_session_log`, `dsh_plugin_packages`, and the telemetry channel `dsh_otel_report` retain their server-defined names.

## Migration

1. Replace the `dsh` executable with `ocean` in scripts and launchers. In this repository, use `pnpm ocean`.
2. Rename `DSH_*` environment variables to `OCEAN_*`. Set `OCEAN_HOME` to your existing data directory if it differs from `~/.ocean`; do not delete or overwrite that directory. Rename `DSH_AGENTS_HOME` to `OCEAN_AGENTS_HOME` when configured.
3. In profile and plugin `package.json` files, rename the `dsh` metadata object to `ocean` and `engines.dsh` to `engines.ocean`. Preserve their values and installed dependencies.
4. Update TypeScript imports and configuration properties from `Dsh`/`dsh` to `Ocean`/`ocean`, including `dshHome` → `oceanHome`. Update references to the renamed subagent package and reinstall dependencies.
5. Reinstall the Desktop command wrapper and update application links to `ocean://`. Use the same data directory for CLI and Desktop.
6. Run `ocean --help` and `ocean --profile web --dump-config`. Confirm the expected home and profile configuration before starting a session.
