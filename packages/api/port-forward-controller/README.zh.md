---
description: "基于 Typert Remote 的 Host 回环 TCP 端口转发：每个连接一个流，连接 Host 自身运行的服务端口，双向以 base64 帧传输。"
kind: "package-reference"
---
# 端口转发控制器

[English](README.md) | 中文

## 概述

`@ocean/ocean-api-port-forward-controller` 拥有 Host 服务 `ctx.portForwardController` 和生成的 Client 命名空间 `ctx.remote.portForward`。一个 `portForward.open` 流就是一个到 Host 自身回环地址端口的 TCP 连接：Client 无需自己建立套接字即可访问 Host 运行的服务，而无论 Client 给出什么地址，Host 都把连接保持在 `127.0.0.1`。Gateway 的 `remote-device` 策略仅在 `terminal:operate` 下允许该操作，因为访问 Host 端口就意味着访问 Host 运行的服务；Gateway 的每套接字流上限约束了一个设备能打开的连接数。

## 目录

- [使用本包](#use-this-package)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发者说明](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

控制器需要 `ctx.typert`，缺少时保持未激活，因此没有 Remote 栈的组合可以正常加载，只是不提供 `portForward` 命名空间。它没有配置项。

`portForward.open({ port })` 先把 `port` 校验为 1 到 65535 的整数，否则在创建任何套接字之前回答 `port-forward/invalid-port`。随后连接 `127.0.0.1:<port>`，并按线路顺序回答帧：

- 连接建立后回答 `{ type: 'connected', port }`。
- 端口发送数据时回答 `{ type: 'data', data }`，其中 `data` 是原始字节的 base64，每帧最多 64 KiB。
- 端口关闭自己一端时回答 `{ type: 'end' }`，这是流的最后一帧。
- 连接被拒绝（`refused`）、因其他原因失败、或没有 FIN 就断开（`unreachable`）时回答 `{ type: 'failed', code, message }`，之后流结束。

Client 的数据项走同一流的上行通道：`{ type: 'data', data }` 按顺序把字节写入套接字，`{ type: 'end' }` 用 `socket.end()` 半关闭它。端口读取较慢时，Host 在读取下一项之前等待 `drain`，因此 Client 写入快于端口接收也不会让套接字缓冲无限增长。取消流会销毁套接字，同时也结束 Client 的上行通道。

只有回环端口可达：Host 从不把 Client 的输入解析为地址，因此被转发的端口不会变成离开 Host 的通用 TCP 代理。

Client 一半是生成的 `ctx.remote.portForward` 接口；本包不提供自己的 Client 服务。Desktop 通过该命名空间把 `OCEAN_DESKTOP_FORWARD_PORTS` 指定的端口转发到自己的回环地址。

-----

<a id="model-experience"></a>
## 模型体验

无。该命名空间是传输面：它不注册提示词、工具或会话事件，也没有任何模型可见的输入或输出经过它。

#### KV Cache 影响

无直接影响；该命名空间的任何流都不会到达模型请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 只有 `127.0.0.1` 可达，因此绑定在其他接口上的 Host 服务不会被转发。放宽地址会把该命名空间变成 Host 网络的代理，这需要单独的策略决定。
- 每个连接消耗设备套接字上的一个流，受 Gateway 流上限约束；没有把多个连接复用到同一个流的机制。
- Host 不上报哪些端口存在。只有连接回答 `refused` 时 Client 才知道没有服务监听，因此端口列表由 Client 自行决定。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>给维护者的工作背景——点击展开</summary>

上行泵在连接建立之前就启动，因为 `net.Socket` 在 `connect` 之前会排队写入；因此立即写入的 Client 不会丢失数据。上行读取被拒绝意味着 Gateway 取消了流，而流通过中止信号销毁套接字，所以该泵吞掉这个错误，而不是再报告一次失败。

</details>
