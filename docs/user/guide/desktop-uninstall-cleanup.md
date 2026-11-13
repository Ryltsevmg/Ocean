# Uninstall Ocean Desktop

English | [中文](desktop-uninstall-cleanup.zh.md)

Use this guide to uninstall Ocean Desktop on macOS, Windows, or Linux. Local data cleanup is optional.

## 1. Uninstall the app

Finish any commands using Desktop's bundled CLI. If you installed the `dsh` command through Desktop, first select **Manage dsh Command… → Remove** in the application menu. This removes Desktop's command registration without uninstalling independent CLI programs.

Quit Ocean, then uninstall it using your platform's procedure:

- **macOS:** Delete the app from Applications in Finder.
- **Windows:** Uninstall it through Settings → Apps → Installed apps on Windows 11, or Control Panel → Programs → Programs and Features.
- **Linux:** Remove the installation using the method that installed it; for an extracted directory, remove that installation directory after quitting the app.

## 2. Inspect local data before cleanup

Deleting local data can permanently remove sessions, credentials, settings, plugins, caches, and shared CLI state. Back up anything you want to keep. Do not delete a directory solely because its name resembles Ocean or DSH.

The current default Ocean home is `~/.ocean`, or `.ocean` under the Windows user profile. `DSH_HOME` can select another location; inspect the setting used to launch Desktop, which may differ from the current terminal. The commands below only print candidate locations and delete nothing. They do not discover Electron's actual `userData` directory or all installation-specific caches.

::: code-group

```sh [macOS]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: $HOME/Library/Caches/@oceanocean-desktop-updater"
# Previous-release ~/.dsh and donor-era appId caches require separate ownership checks.
```

```powershell [Windows]
$ErrorActionPreference = 'Stop'
if (-not $env:USERPROFILE -or -not $env:LOCALAPPDATA) {
    throw 'USERPROFILE and LOCALAPPDATA must be set.'
}
$oceanHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.ocean' }
"Ocean home candidate: $oceanHome"
"Updater cache candidate: $(Join-Path $env:LOCALAPPDATA '@oceanocean-desktop-updater')"
# Previous-release .dsh and @deepseek-ai data are NOT removed.
# Inspect them separately; delete only data you recognize and no longer need.
```

```sh [Linux]
: "${HOME:?HOME must be set}"
printf '%s\n' \
  "Ocean home candidate: ${DSH_HOME:-$HOME/.ocean}" \
  "Updater cache candidate: ${XDG_CACHE_HOME:-$HOME/.cache}/@oceanocean-desktop-updater"
# Previous-release ~/.dsh requires a separate ownership check.
```

:::

The updater cache name is derived from the Desktop package name, not the product title. These candidates use the current `@ocean/ocean-desktop` package; another build can differ. On Windows, the [uninstaller](../../../apps/desktop/installer/uninstall.nsh) checks product-name and package-name application-data directories and the updater cache, but preserves the Ocean home; updates and retained-data reinstalls can preserve application data too.

Find the actual Electron data and log directories for your installation before removing them; the [diagnostics reference](../../../apps/desktop/docs/diagnostics/README.md#report-contents) describes log locations. macOS preference, ShipIt, HTTP storage, and system-cache names depend on the installed bundle identifier. Packaging requires an explicit `DSH_DESKTOP_APP_ID`; `com.deepseek.dsh` is not a universal Ocean identifier. Do not run a wildcard cleanup for that identifier unless you have independently identified those files as leftovers from your previous installation.

`~/.dsh` was a previous default, not the current default. Delete it, previous `@deepseek-ai` application data, or donor-era identifier caches only if you recognize those leftovers and no other installation needs them. Development and test directories require their own checks.

## 3. Remove verified data and check

After confirming each exact path and its ownership, remove only the directories you chose using your file manager. Leave unrecognized paths untouched. Confirm that the chosen paths no longer exist before reinstalling. If removal reports an error, inspect the remaining files and resolve the error rather than broadening the deletion target.
