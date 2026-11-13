---
kind: upgrade-guide
description: MCP HTTP endpoints that redirect to another origin must be configured with their verified final URL.
---

# MCP HTTP redirects stay within one origin

English | [中文](guide.zh.md)

## Change

Previously, Streamable HTTP followed redirects to another origin and could forward configured secret headers and MCP request bodies. Ocean now uses MCP client SDK 2.3.0 with explicit same-origin redirect handling for POST, GET and DELETE. Changing the host, port or scheme is rejected, except that the SDK permits a same-host HTTP-to-HTTPS upgrade when both URLs use default ports. HTTPS downgrades are rejected. Same-origin 307/308 redirects remain supported; POST redirects that would change the request method are rejected. Stdio is unchanged.

## Migration

1. If an HTTP MCP connection reports a redirect refusal, verify the intended server's final HTTPS endpoint with its operator. Do not copy an untrusted redirect target blindly.
2. Update that server's `url` in its MCP plugin configuration. Ensure its configured `headers` and credential references are intended for the new endpoint.
3. Reconnect the server and confirm discovery and a harmless tool call work. No redirect override or TLS bypass is required. Existing direct endpoints need no changes.
