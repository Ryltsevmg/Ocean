# 卸载 Ocean Desktop

[English](desktop-uninstall-cleanup.md) | 中文

本指南用于在 macOS、Windows 或 Linux 上卸载 Ocean Desktop。清理本地数据是可选步骤。

## 1. 卸载应用

先结束所有使用 Desktop 内置 CLI 的命令。如果通过 Desktop 安装了 `dsh` 命令，请先在应用菜单中选择 **Manage dsh Command… → Remove**。这只移除 Desktop 的命令注册，不会卸载独立的 CLI 程序。

退出 Ocean，然后按平台的方式卸载：

- **macOS：**在 Finder 的「应用程序」中删除应用。
- **Windows：**通过 Windows 11 的「设置 → 应用 → 安装的应用」，或「控制面板 → 程序 → 程序和功能」卸载。
- **Linux：**使用与安装方式对应的方法移除应用；如果是解压得到的目录，请在退出应用后移除该安装目录。

## 2. 清理前检查本地数据

删除本地数据可能永久移除会话、凭据、设置、插件、缓存和共享 CLI 状态。请先备份需要保留的内容。不要仅因目录名类似 Ocean 或 DSH 就删除它。

当前默认 Ocean home 是 `~/.ocean`，在 Windows 上是用户配置文件目录下的 `.ocean`。`DSH_HOME` 可以选择其他位置；请检查启动 Desktop 时使用的设置，它可能不同于当前终端。以下命令只打印候选位置，不删除任何内容。它们不会发现 Electron 实际使用的 `userData` 目录，也不会列出所有安装专用缓存。

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

更新器缓存名从 Desktop 包名派生，而不是从产品标题派生。这些候选位置使用当前的 `@ocean/ocean-desktop` 包名；其他构建可能不同。在 Windows 上，[卸载器](../../../apps/desktop/installer/uninstall.nsh)检查以产品名和包名命名的应用数据目录及更新器缓存，但保留 Ocean home；更新和保留数据的重新安装也可能保留应用数据。

移除 Electron 数据与日志目录前，请先确认实际安装使用的路径；[诊断参考](../../../apps/desktop/docs/diagnostics/README.zh.md#report-contents)说明日志位置。macOS 偏好、ShipIt、HTTP 存储和系统缓存的名称取决于已安装应用的 bundle 标识符。打包要求显式设置 `DSH_DESKTOP_APP_ID`；`com.deepseek.dsh` 不是通用的 Ocean 标识符。除非已独立确认这些文件是以前安装留下的内容，否则不要针对该标识符执行通配符清理。

`~/.dsh` 是以前的默认位置，不是当前默认位置。只有确认这些残留数据的归属，且其他安装不再需要时，才删除它、以前的 `@deepseek-ai` 应用数据或原项目时期的标识符缓存。开发和测试目录需要单独检查。

## 3. 移除已核实的数据并检查

确认每个确切路径及其归属后，使用文件管理器仅移除选定的目录。不认识的路径保持不动。重新安装前，确认选定路径已不存在。如果移除时报告错误，请检查残留文件并解决错误，不要扩大删除目标。
