# Python contributor workflows

English | [中文](development.zh.md)

Follow the workflow for the contributor outcome you need: build runtime artifacts, validate the SDK, run against source, or build distributions. Package behavior belongs in the [SDK reference](sdk/README.md) and [runtime carrier reference](sdk-runtime/README.md).

## Build runtime artifacts

Platform executables are build artifacts and are not checked into git. Run the build from the repository root:

```sh
pnpm install
pnpm exec tsx scripts/build-exe-for-python-sdk.ts
```

Use `--skip-build` when the required `lib/` artifacts already exist, or `--targets=node24-linux-x64,node24-linux-arm64,node24-macos-arm64,node24-macos-x64,node24-win-x64` to select platforms. Build each target on its native architecture. Products land in `dist-exe/` and the script syncs the selected carriers into `python/sdk-runtime/`. Windows emits `.exe` and `-rg.exe`; macOS also syncs the matching spawn helper required by `node-pty`.

## Validate the SDK

Keep the virtual environment outside `python/`, install the test group, and run the Python suite:

```sh
export UV_PROJECT_ENVIRONMENT="$PWD/tmp/py-sdk-venv"
uv sync --project python/sdk --group test
uv run --project python/sdk pytest
```

`python/sdk/tests/test_bundled_runtime.py` exercises available bundled carriers and skips a carrier when its artifact has not been built. For repository-wide test policy, see [Testing](../docs/testing.md).

Installed-wheel smokes can verify the relocated Office sidecar when matching engine packages are available. Python tests reject white, transparent, reversed and text-free output; Ocean verification does not build the platform wheel matrix.

Set `OCEAN_OFFICE_TEST_ARTIFACTS` to a new directory to retain the installed-wheel smoke’s Office inputs, PNGs, manifests and failure diagnostics. Temporary runtime files are excluded.

[Ocean verification](../.github/workflows/ocean-verify.yml) installs the locked test group and runs pytest after building the CLI, covering fake runtime peers and keyless built-runtime projections. Bundled-carrier tests still skip when their separate artifacts are absent. `scripts/smoke-python-runtime.py` drives a packaged runtime; `--installed-wheel` verifies installed distributions outside the checkout. A focused local run can select one built executable and scenario:

```sh
uv run --project python/sdk python scripts/smoke-python-runtime.py \
  --scenario sdk-minimal --exe dist-exe/deepseek-harness-sdk-runtime-macos-arm64
```

SDK scenarios compare committed expected output under `scripts/snapshots/python-sdk-single-exe/`. `minimal/model-visible.json` pins the Linux/macOS `sdk-minimal` profile's assembled system prompts, advertised tool schemas, and model-visible messages; `minimal/win-x64/model-visible.json` pins its PowerShell counterpart. `authoring/model-visible.json` pins the Linux/macOS Office authoring catalog and dependency result; `authoring/win-x64/model-visible.json` pins the Windows catalog, including the ACL diagnostic skill. A plugin that contributes an unintended system section or user message therefore fails the job, and every message the profile emits is compared. `advanced/` pins one complex process's SDK result and parent/child session logs across every target. `restart/` launches two complete SDK runtime processes against one persistence root and snapshots their isolated model histories, high-level results, and separate durable logs across every target. Its resumed turn initializes a different model and pins the persisted selection, request route, and SDK event sequence. `sdk-minimal-in-history` reuses the persistent-shell and editor scenario with a section that changes after the first successful shell call. `minimal-in-history/prompt-history.json` pins both prompt versions, the unchanged leading prompt in later requests, appended SDK system-message events, and `request/context.systemPromptUpdate`; tool schemas stay fixed and the editor file is checked independently. `sdk-dynamic-tools` pins native tool additions and removals in `dynamic-tools/tool-history.json`, including historical header references and agreement between Python SDK results, notifications, and persisted events. Rerun the owning scenario with `--update-snapshots` and review that diff before committing it.

`scheduler-recovery/` records a failed tool turn and a subsequent completed turn. It preserves the original `UNKNOWN` turn error, the first tool's completed result, and `TOOL_OUTCOME_UNKNOWN` / `TOOL_NOT_STARTED` results for the remaining calls. `sdk-snapshot` and `all` include this case; `--scenario sdk-recovery` runs it alone.

The `advanced` and `restart` comparisons match native delivery qualifiers against each input's own Session generation, including SDK events and notifications. Captured and other delivery generations retain their numeric values. Each side must use one generation across its Session roles, and fresh logs must identify the current writer. Comparison never rewrites committed recordings.

The optional `--scenario sdk-live --installed-wheel` smoke requires an explicitly supplied API key. It performs two tool-using turns against `https://api.deepseek.com`, then checks a host-only file challenge and exact sentinel responses. Ocean verification supplies no provider credentials and does not run this scenario.

An interactive smoke test needs `DEEPSEEK_API_KEY` in the environment or repository-root `.env`:

```python
from deepseek_harness import DeepSeekHarness

with DeepSeekHarness(ocean_home="/absolute/path/to/test-ocean-home") as harness:
    print(harness.run("say hi").final_response)
```

Alternatively export a non-empty `OCEAN_HOME`. The SDK rejects a launch that would silently use `~/.ocean`.

## Run against Node source

Repository contributors can select either development route; both execute the normal `ocean --profile sdk` launcher:

- Set `OCEAN_RUNTIME_MODE=node` to use the built Node carrier on system Node `>=24.9`. The build script refreshes this carrier, but distributions never include or auto-select it.
- Set `ocean_bin` to the absolute built `apps/cli/lib/bin.js` path to exercise the checkout's CLI directly. Supply an explicit `ocean_home`, plus `profile` and ordered `patches` as needed.

`python/sdk/tests/manual_sdk_agent_smoke.py` uses the internal `_launch_args` test adapter to exercise the unbuilt TypeScript CLI under tsx. Arbitrary argv replacement is intentionally absent from the public SDK.

The manual [shutdown example](sdk/tests/manual_sdk_shutdown_smoke.py) uses ordinary SDK calls: run one short real-model turn, close immediately with the default 1-second budget, then open another runtime and restore the same session. Install the SDK/runtime and set `DEEPSEEK_API_KEY` before running:

```sh
python python/sdk/tests/manual_sdk_shutdown_smoke.py
```

The example prints the close duration and history files, retains its temporary directory, and lets restoration failures raise normally. Recovery uses a separate 30-second shutdown budget. Reproduction depends on the host and first-turn timing; successful restoration does not establish a shutdown latency bound. This manual example is not collected by pytest.

## Build distributions

The root `package.json` version is authoritative for both Python distributions. The staging script injects that version into both wheels and pins the SDK to the same `deepseek-harness-runtime-bin` version.

Build the pure SDK wheel once and one runtime wheel on each native platform:

```sh
version="$(python - <<'PY'
import runpy

release = runpy.run_path("scripts/build-python-release.py")
print(release["pep440_version"](release["repository_version"]()))
PY
)"
python scripts/build-python-release.py --package sdk --output-dir dist-python
python scripts/build-python-release.py --package runtime --platform macos-arm64 --runtime-exe dist-exe/deepseek-harness-sdk-runtime-macos-arm64 --output-dir dist-python
pip install \
  "dist-python/deepseek_harness_sdk-$version-py3-none-any.whl" \
  "dist-python/deepseek_harness_runtime_bin-$version-py3-none-macosx_14_0_arm64.whl"
```

The runtime distribution is wheel-only. Build one wheel per supported native target: Linux x64, Linux arm64, macOS 14 or newer on arm64 and x64, and Windows x64 (`win_amd64`). Prerelease repository versions such as `0.0.1-rc.1` use normalized PEP 440 spelling, such as `0.0.1rc1`, in filenames and metadata.

## Validate a release candidate

Validate candidate wheels locally in a fresh environment outside the checkout: install the matching SDK/runtime set, unset `PYTHONPATH` and `OCEAN_RUNTIME_MODE`, and run the keyless installed-wheel smoke. Check filenames, versions and checksums before retaining artifacts for review.

Ocean GitHub Actions do not publish Python packages. The [.github release prerequisites](../.github/AGENTS.md#release-prerequisites) apply before enabling publication.
