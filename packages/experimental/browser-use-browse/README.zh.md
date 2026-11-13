---
description: "通过本地 browse relay，按需控制现有 Chromium profile 中由 agent 独占的标签页。"
kind: "package-bundle"
---

# @ocean/ocean-browser-use-browse

[English](README.md) | 中文

## 概述

本可选浏览器提供方面向 **anomalyco/browse v0.0.16**。它控制用户已配对 Chromium profile 中由 agent（智能体）拥有的标签页，使用该 profile 的现有登录状态。它不会启动空白浏览器，也不隔离账户或 cookie。

## 目录

- [使用此包](#use-this-package)
- [工具和生命周期](#tools-and-lifecycle)
- [上游](#upstream)
- [模型体验](#model-experience)
- [已知限制与待办事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用此包

本插件默认禁用，不在交付的组合中。只有用户批准扩展权限后，才能安装并配对上游 browse。本包不会安装扩展、启动 relay、更改其他客户端配置或开启上游自动更新。为获得可复现的试用结果，应使用单独管理、关闭自动更新的本地 relay。版本不匹配时拒绝连接。

可选包通过[配置层补丁](cordis.patch.yml)添加浏览器注册表、稳定的设置服务及禁用的提供方。使用用户设置面板或经审核的 `browser-use-browse` profile 覆盖；加载此包并不连接或启用提供方。提供凭据或允许工具前，请阅读[设置详情](docs/DETAIL.md)。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `false` | 审核连接设置后显式允许浏览器工具 |
| `endpoint` | `http://127.0.0.1:19988` | 本地 relay，不接受远程服务器 |
| `tokenFile`, `browser` | 空 | 私有令牌文件路径及显式配对的浏览器 ID |
| `allowedOrigins` | `[]` | 明确批准的公共 HTTPS 来源 |
| `timeoutMs`, `handoffTimeoutMs` | `30000`, `300000` | 操作及人工接管的时间限制 |
| `maxResponseBytes` | `262144` | relay 响应的最大字节数 |

令牌文件必须是当前用户拥有的常规文件，不能是符号链接，且组和其他用户没有访问权限。插件读取但不打印或复制令牌。端点、浏览器 ID 和来源列表属于 profile 配置，不是模型参数。此 MVP 仅接受显式公共 HTTPS 来源。relay 的导航允许列表不是网络出口隔离：网页仍可能加载第三方子资源。

<a id="tools-and-lifecycle"></a>
## 工具和生命周期

`ocean_browser_navigate`、`snapshot`、`click`、`fill` 和 `handoff` 使用严格参数和固定上游代码。插件不提供任意 JavaScript、上游会话选择、设置、密钥 profile、录制、网络捕获或接管用户标签页。普通 Ocean 工具执行流程仍负责必要的操作确认。`fill` 仅用于普通文本；敏感输入应通过 handoff 交给用户。密码和敏感自动填充字段也会被拒绝，但字段检测并不是通用秘密检测器。

每个活动 Ocean Agent 按需获得一个随机浏览器会话 ID。调用按所有者串行执行，包括子 agent；任何工具都不接受会话 ID。两个所有者不能通过此提供方选择对方的标签页。恢复后的新激活获得新的标签页状态。浏览器 profile 的登录仍共享。卸载提供方或 dispose（资源释放）所有者时，仅删除其拥有的 relay 会话，不关闭浏览器或 relay。

超时、取消或不可信响应会阻止该连接继续执行。操作可能已生效；提供方不重试。获取资源失败时，为该活动 Agent 保留失败标记。请检查浏览器后再启动另一 Ocean 会话。清理失败会报告，不会声称成功。Handoff 有独立、有限的人为等待时间；到期表示结果不确定，而不是已撤销。取消不能撤销已发送的浏览器操作。

清理失败会在 Host 的剩余生命周期内阻止替代浏览器执行权限。Host 根上下文独立于可选设置服务和提供方拥有此失败状态，因此禁用并重新启用此包不会清除它。设置服务的释放会等待清理完成；Host 关闭时移除状态服务，但不会阻止尚未完成的清理记录失败。独立 Host 不共享此状态。

<a id="upstream"></a>
## 上游

协议参考：[browse v0.0.16](https://github.com/anomalyco/browse/tree/v0.0.16)，尤其是 `cli/src/relay/client.ts`、`schema.ts` 和 `secrets.ts`。MIT 署名见 `THIRD_PARTY_NOTICES`。本包未复制上游运行时。

<a id="model-experience"></a>
## 模型体验

### 浏览器操作与指导

#### 模型看到什么

启用时，`ocean_browser_navigate`、`ocean_browser_snapshot`、`ocean_browser_click`、`ocean_browser_fill` 和 `ocean_browser_handoff` 提供受限操作与浏览器指导。输出为有限长度的网页文本及上游警告、挑战摘要，由普通工具结果日志记录。网页内容是不可信数据，不是指令或授权。不使用独立推理提供方。

#### Token 影响

启用时，五个工具定义、一个指导段落及有长度限制的工具结果占用模型上下文。

#### KV Cache 影响

启用或禁用提供方会更改工具定义和一个提示词段落。每个结果进入所属 Session 日志；浏览器状态不会从日志重建。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与待办事项

- 这是实验性适配器，不是已交付扩展或完整安装器。验证使用假 relay 和真实 Ocean Loader/工具循环；仍需真实配对浏览器试用和 UI 验收。POSIX 私有文件检查目前面向 Linux/macOS；Windows 令牌 ACL 验证另行处理。

- 上游 HTTP API 为私有接口，受版本检查限制。版本字符串不能认证同版本源码修改或构建来源。用户必须安装可信构建并配对正确浏览器。同用户本地进程及 relay 的其他客户端不在此插件隔离范围内。Host 硬崩溃/OOM 后，上游可能保留孤立会话和标签页；不保证自动崩溃清理。请通过用户控制的上游界面检查和删除。

- 远程 relay、文件/本地网络来源、任意 JS、接管用户标签页、共享会话、密钥、录制、自动更新、配对 UI 和崩溃恢复记录于 Linear RMG-334。开发本包未授予任何浏览器权限。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
