---
kind: upgrade-guide
description: "Host 与打包客户端的发布标识不同或无法比较时，Desktop 拒绝远程引导。"
---

# 统一 Desktop 与远程 Host 的发布版本

[English](guide.md) | 中文

## 变更

设备协议握手成功不再足以启动远程 Desktop 视图。执行远程引导注入前，Desktop 要求唯一的 `__OCEAN_BOOT__` 图，其 `release.version` 和 `release.commit` 与打包外壳一致。只有双方构建都省略提交信息时才允许缺失该字段。发布信息缺失、格式错误、重复或不匹配时拒绝连接，并退出刚创建的登录。现有本地工作区仍可使用。

此比较只检查发布标识，不保证完整的静态模块 ABI 或插件组合兼容性。

## 迁移

1. 使用同一 Ocean 发布版本和源提交部署远程 Host 与 Desktop。源码构建时重新构建双方；构建流程会把 `OCEAN_CLIENT_VERSION` 和 `OCEAN_CLIENT_COMMIT_HASH` 固定到产物中。运行时环境覆盖不能替换打包值。
2. 自定义 Host 引导生产方必须包含唯一的全局 `__OCEAN_BOOT__` 注入，其图携带这些发布字段。随附的 client-module registry 已发布这些字段。
3. 从 Desktop 重新连接。发布标识匹配时打开远程视图；不兼容时，在任何远程注入进入该视图前，显示要求更新应用或服务器的本地化提示。拒绝连接后若无法确认退出，请通过 Host 的活动设备管理撤销受影响的设备及其登录。

启动和失败行为参见 [Desktop 远程连接](../../../../apps/desktop/README.zh.md)。
