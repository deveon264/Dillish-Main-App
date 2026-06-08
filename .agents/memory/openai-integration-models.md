---
name: OpenAI integration model + empty-output guard
description: Which model the Replit OpenAI integration serves, and why reasoning-model output must be guarded before JSON.parse.
---

# Replit OpenAI integration: model name + reasoning empty-output

The Replit OpenAI integration (`javascript_openai_ai_integrations`) is reached
via `process.env.AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`.
Those credentials are injected only into the **app runtime** (deployment /
workflow), NOT the agent bash shell or the code-execution sandbox, and
`viewEnvVars` reports them as unset. So you cannot reproduce an analyze/chat call
from the sandbox; a local Metro run would just hit the "not configured" guard.

**Rule:** use the model the blueprint actually serves. The installed
integration's own scaffold (`.replit_integration_files/.../chat`, `batch`)
uses `gpt-5.4` ("the newest OpenAI model") everywhere. Ad-hoc names like
`gpt-5-mini` are not guaranteed to be served and can get the request rejected.

**Why:** the calorie analyzer was broken because the route called `gpt-5-mini`.

**Empty-output guard:** these are reasoning models. They can spend the whole
`max_completion_tokens` budget on reasoning and return content === `""`
(finish_reason "length"). `content ?? "{}"` does NOT catch `""` (only null), so
`JSON.parse("")` throws. Always trim and explicitly check for empty content
before `JSON.parse`, and log `finish_reason` + `usage` on the empty path.
