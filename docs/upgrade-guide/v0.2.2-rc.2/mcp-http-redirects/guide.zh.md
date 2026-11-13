---
kind: upgrade-guide
description: 重定向到其他源的 MCP HTTP 端点必须改用经过验证的最终 URL。
---

# MCP HTTP 重定向仅限同源

[English](guide.md) | 中文

## 变更

此前 Streamable HTTP 会跟随跨源重定向，可能转发配置中的秘密请求头和 MCP 请求体。Ocean 现使用 MCP client SDK 2.3.0，并对 POST、GET 和 DELETE 显式启用同源重定向策略。协议、主机或端口变化都会被拒绝，但 SDK 允许两个 URL 均使用默认端口时，同一主机名的 HTTP 升级为 HTTPS。HTTPS 降级会被拒绝。同源 307/308 仍受支持；会改变请求方法的 POST 重定向被拒绝。Stdio 不受影响。

## 迁移

1. 如果 HTTP MCP 连接报告拒绝重定向，请向服务器运营者确认预期的最终 HTTPS 端点。不要盲目复制不可信的重定向目标。
2. 在该 MCP 插件配置中更新 `url`。确认配置的 `headers` 和凭据引用确实适用于新端点。
3. 重新连接服务器，确认发现流程和一个无副作用的工具调用正常工作。无需覆盖重定向策略或绕过 TLS。现有直连端点无需修改。
