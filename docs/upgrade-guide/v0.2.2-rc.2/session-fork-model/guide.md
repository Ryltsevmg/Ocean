---
kind: upgrade-guide
description: "Forking a Session with an unavailable recorded model requires an explicit available replacement selection."
---

# Choose a model when recovering a Session

English | [中文](guide.zh.md)

## Change

`session.fork` rejects a fork whose inherited model is unavailable unless the request supplies an available `modelSelection`. Previously, a fork could inherit the unavailable route and fail when its first prompt ran. The original Session and its history remain unchanged. An explicit replacement is recorded in the child after its inherited history; it does not rewrite historical request headers or submit a prompt.

## Migration

1. Custom clients that fork unavailable routes must include `modelSelection: { provider, model, reasoningEffort? }` in their `session.fork` request, using an available model selected by the user. Do not substitute a default silently or edit stored Session events.
2. In the conversation UI, use **Continue in a new conversation** on a model-route or authentication failure, choose an available model, and confirm. If no models are available, configure a model before trying again. Authentication failures do not establish that another model's credentials work.
3. Confirm that a separate conversation opens with the selected model and inherited history, while the original conversation remains readable and unchanged. Send the next prompt explicitly; recovery never retries a failed operation automatically.
