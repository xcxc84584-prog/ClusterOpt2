# PR14.5 — PRD: AI Model Provider and Task Pipeline

## Functional requirements
1. Continue legacy Cluster Windows Agent protocol on authenticated loopback,
   with text-only model configuration, `provider_get`, `provider_set`,
   `task`, `task_cancel`, `provider_info`, `task_status`,
   and `task_result`.
2. Separate model configuration from task execution permissions.
3. The API key must be entered only in a trusted host-owned dialog and
   sent to the already-paired Windows Agent, never to the plugin frame,
   Worker, Hub Request payload, OMU Log or browser storage.
4. Every task has a generated requestId, a maximum 8,000-character
   prompt, explicit status transitions and cancellation; reject duplicate
   active tasks and unsolicited/mismatched responses.
5. No filesystem, shell, MCP/OAuth or host DOM authority.
6. Preserve existing PowerShell and editor behavior, draft PR14 and
   canonical version authority. Close/disable/uninstall releases tasks.

## Acceptance
VTE confirms Request/Response, EHU/Log, Dependency, denial and
cancellation. Chromium covers form, no browser key storage, task
send/cancel, and the permission boundary. An actual Windows Agent
and OpenAI API key must be verified before claiming end-to-end PASS.
