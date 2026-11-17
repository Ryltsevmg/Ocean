---
kind: upgrade-guide
description: "远程设备辅助 API 改用明确的静态包子路径，不再从 Host 插件入口导入。"
---

# 远程传输入口与流数量限制

[English](guide.md) | 中文

## 变更

使用远程设备认证、流传输和上传路由常量的 Node 消费方必须改用具名静态入口。Host 插件入口不再重新导出 `DeviceClient`、其类型化错误与设备常量、`openDeviceStreamSocket` 或 `FILE_UPLOAD_ROUTE`。CLI 和 Desktop 消费方也不应再从 Gateway Client 插件入口导入独立的流辅助 API。

Gateway 现在默认将每条 WebSocket 的并发逻辑流限制为 256 条，包括尚在分发的请求。达到 `maxStreamsPerSocket` 后再次打开流会以状态码 1013 关闭 socket；客户端必须重连并重新同步。

## 迁移

1. 将 `DeviceClient`、`DeviceClientError`、`DeviceProtocolVersionError`、`DeviceSessionRejectedError`、`DeviceSessionUnavailableError` 的导入改为 `@ocean/ocean-client-connection/device`。仅需要 `DEVICE_*` 常量、Host 标识或 socket 接口的共享 Host/Client 模块改用纯 `@ocean/ocean-client-connection/protocol`，避免引入另一编译端的插件实现。
2. Node 传输消费方从 `@ocean/ocean-api-gateway/device` 导入 `openDeviceStreamSocket`、`ClientUplinkQueue`、`RemoteStreamCarrierError` 和 `RemoteStreamMuxClient`。
3. 从 `@ocean/ocean-client-file-upload/protocol` 导入 `FILE_UPLOAD_ROUTE` 及共享上传协议值。
4. 保留 Cordis 插件名称和 `cordis.yml` 条目。使用更新后的声明构建，并对每个使用的子路径运行打包后的 Node 导入冒烟检查。Node 消费方不再需要仅为这些辅助 API 引用 Gateway Client 编译配置。

5. 检查每条 socket 的并发订阅需求。需要更高容量时，在 Gateway 的 `cordis.yml` 配置中明确设置 `maxStreamsPerSocket`；保留 1013 关闭后的重连和重新同步处理。

API 归属参见 [Connection](../../../../packages/client/connection/README.zh.md)、[Gateway](../../../../packages/api/gateway/README.zh.md) 和[上传](../../../../packages/client/file-upload/README.zh.md)参考。
