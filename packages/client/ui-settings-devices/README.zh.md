---
description: "设备设置分区：显示与此 Host 配对的设备及其已授予的权限，并可吊销任意一台活动设备。"
kind: "package-reference"
---
# 设备设置

[English](README.md) | 中文

## 概述

`@ocean/ocean-client-ui-settings-devices` 贡献一个设置分区，列出与当前浏览器所连 Host 配对的设备，并可吊销其中一台。它读写 [`@ocean/ocean-api-device-controller`](../../api/device-controller/README.zh.md) 生成的 `devices` Remote namespace；Host 始终是设备状态的唯一权威，本包只渲染注册表报告的内容。该分区仅在调用方 Peer 可以读取清单时安装，因此以远程设备身份通过认证的浏览器不会看到一个其每个动作都会被 Gateway 拒绝的页面。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

分区以 `devices` 为 id 注册进 `settings.section`，位于“通用”与“模型”之间，并只对 Host 的所有者显示。注册前它先读取一次清单：Host 回答 `devices/unavailable`（在没有设备注册表的模式下运行）时什么都不注册；其他任何结果都会注册分区，因此读取失败时仍可提供“重试”。它渲染五种状态：首次读取进行中的加载态、设备清单、空清单、读取失败并提供“重试”按钮，以及清单内部的——逐行吊销前的确认、进行中的“正在吊销…”，以及逐行的失败提示（该行保持原样）。

每行显示设备标签、注册表标识符的前八个字符（完整值是该元素的 tooltip）、它是活动还是已吊销，以及它持有的权限；在权限出现之前创建的设备持有全部权限，并如实说明，而不是显示空列表。只有活动设备提供“吊销”。吊销成功后该行立即标记为已吊销，因为 Host 的回执已经意味着持久写入已提交、设备的活动传输已关闭；被拒绝或传输失败则保留该行并提供再次尝试。

分区在每次挂载时读取清单，因此重新打开设置会反映期间从管理员套接字吊销的设备。

-----

<a id="model-experience"></a>
## 模型体验

无。该分区不注册任何提示词、工具或会话事件。

#### KV 缓存影响

无直接影响；这里的任何文案都不会进入模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 配对新的设备与轮换其令牌仍留在本地管理员套接字（`ocean remote-device`）；本分区只读取与吊销。
- 清单是读取而非流式的：在另一个窗口执行的吊销会在下一次挂载或重试时可见。
- Host 在分区注册后失去设备注册表时，分区在清单位置显示说明，而不会注销自己。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
