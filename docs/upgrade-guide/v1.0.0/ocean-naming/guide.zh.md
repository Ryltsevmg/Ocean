---
kind: upgrade-guide
description: Ocean 命令、环境变量和插件元数据替代 DSH 名称。
---

# Ocean 名称

[English](guide.md) | 中文

## 变更

首选 CLI 命令为 `ocean`；`dsh` 保留为别名。环境变量使用 `OCEAN_` 前缀，插件清单使用 `ocean` 和 `engines.ocean`。默认主目录仍为 `~/.ocean`。TypeScript 标识符中的 `Dsh` 改为 `Ocean`；子代理 SDK 包改为 `@ocean/ocean-subagent-ocean-sdk`。桌面应用链接使用 `ocean://`；仍接受 `dsh://open`。内部资源 URI 协议、浏览器存储键、所有权标记和跨版本锁保留现有标识符。

当对应的 Ocean 名称不存在时，仍接受旧的 `dsh` 清单元数据、`engines.dsh`、继承的 `DSH_*` 启动变量及 SDK 的 `dshBin`/`dshHome` 选项。显式 Ocean 值优先。保留旧的主目录路径导出，供已安装插件使用。

历史 Session 代际保持不变。DeepSeek 请求字段 `dsh_session_log`、`dsh_plugin_packages` 和遥测通道 `dsh_otel_report` 保留服务端定义的名称。

## 迁移

1. 将脚本和启动器中的 `dsh` 可执行命令改为 `ocean`。在本仓库中使用 `pnpm ocean`。
2. 将 `DSH_*` 环境变量改为 `OCEAN_*`。如果现有数据目录不是 `~/.ocean`，将 `OCEAN_HOME` 指向该目录；不要删除或覆盖该目录。如果配置了 `DSH_AGENTS_HOME`，将其改为 `OCEAN_AGENTS_HOME`。
3. 在配置档和插件的 `package.json` 中，将 `dsh` 元数据对象改为 `ocean`，将 `engines.dsh` 改为 `engines.ocean`。保留其值和已安装的依赖项。
4. 将 TypeScript 导入和配置属性中的 `Dsh`/`dsh` 改为 `Ocean`/`ocean`，包括 `dshHome` → `oceanHome`。更新已更名的子代理包引用并重新安装依赖项。
5. 重新安装桌面应用的命令包装器，将应用链接改为 `ocean://`。CLI 和桌面应用应使用同一数据目录。
6. 运行 `ocean --help` 和 `ocean --profile web --dump-config`。启动会话之前，确认主目录和配置档符合预期。
