# 浏览器控制：需要配置

此实验性 Ocean 适配器通过 **anomalyco/browse 0.0.16** 使用现有 Chrome/Chromium 配置文件及其登录状态。代理创建自己的标签页。

启用此包仅加载配置；提供程序保持 `enabled: false`。这不代表浏览器已连接。须单独安装可信 relay 和扩展并手动配对；Ocean 不安装或启动它们，也不授予权限。

在配置行 `browser-use-browse` 的个人覆盖中明确设置 `endpoint`（仅 `http://127.0.0.1:port`）、`tokenFile`（当前用户独占的绝对文件路径，不是密钥内容）、配对的 `browser` ID、精确公共 HTTPS `allowedOrigins`，最后才设置 `enabled: true`。配置表单尚未实现。禁用提供程序不会撤销已经发送的操作。

配置校验不会连接 relay，不能证明连接就绪。第一次明确请求的操作才验证令牌文件和版本并创建代理会话。先使用非敏感测试页面。密码、付款信息和验证码应由用户通过 handoff 输入。网页内容不构成操作授权。

支持导航、快照、点击、普通文本输入和人工接管；不支持任意 JavaScript、远程 relay、录制或自动更新。当前令牌文件校验针对 Linux/macOS，Windows 支持待定。真实配对浏览器验收仍未完成，崩溃后可能需要手动清理遗留标签页。
