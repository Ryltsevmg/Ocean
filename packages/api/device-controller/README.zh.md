---
description: "仅限所有者的 Host 设备管理，经由 Typert Remote：带权限的持久设备清单，以及同时关闭设备活动传输的吊销。"
kind: "package-reference"
---
# Device Controller

[English](README.md) | 中文

## 概述

`@ocean/ocean-api-device-controller` 拥有 Host 的 `ctx.deviceController` 服务与生成的 Client `ctx.remote.devices` namespace。两个方法服务于面向所有者的设备页面：`devices.list` 读取持久设备注册表，`devices.revoke` 通过与本地管理员套接字相同的 Connection 路径吊销一台设备，因此该设备的活动 Peer 会被断开，而不是在已吊销的记录上继续运行。两个响应都不携带令牌、校验值或会话密钥。两个方法都仅限所有者：Gateway 的 `remote-device` 策略只允许其权限目录列出的动作，而没有任何设备权限列出 `devices/*`。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

控制器需要 `ctx.connection` 与 `ctx.typert`，任一缺失时都不激活，因此没有 Connection 的组合可以正常加载，只是不暴露 `devices` namespace。它不拥有任何配置。

`devices.list()` 按注册表顺序回答 `{ id, label, revoked, scopes? }` 行。`revoked` 报告持久状态，所有者因此能区分活动设备与已经退出的设备；`scopes` 携带设备持有的权限，对权限出现之前创建的设备缺省，这类设备持有全部权限。没有设备注册表的 Host——所有者登录模式，那里永远没有设备参与认证——回答 `devices/unavailable` 而不是空列表，因为“这个 Host 没有设备注册表”与“这个 Host 没有设备”是两件不同的事实。

`devices.revoke({ id })` 先在注册表中解析该 id，对不存在的 id 回答 `devices/not-found`，然后调用 `ctx.connection.revokeDevice`，由它写入吊销并释放该设备的所有活动传输租约。回答是 `{ id, revoked: true }`，调用方不需要再读一次来确认。吊销一台已吊销的设备会被接受，并回答同一张回执。

Client 半侧是生成的 `ctx.remote.devices` 面；本包不自带 Client 服务。`@ocean/ocean-client-ui-settings-devices` 把它渲染为设置里的“设备”分区。

-----

<a id="model-experience"></a>
## 模型体验

无。该 namespace 是所有者管理面：它不注册任何提示词、工具或会话事件，也不扩大任何面向设备的能力。

#### KV 缓存影响

无直接影响；该 namespace 的任何方法都不触及模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 处于所有者登录模式的 Host 没有设备注册表，两个方法在那里都回答 `devices/unavailable`；设置分区把它报告为加载失败，而不是隐藏自己。
- 创建设备与轮换令牌仍留在本地管理员套接字（`ocean remote-device`）：该 namespace 只读取与吊销。
- 清单不是流式的。在别处执行的吊销会在下一次 `list` 调用时可见，这也正是设置分区的重试所做的事。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
