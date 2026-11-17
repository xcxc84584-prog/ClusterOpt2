# PR14.5 Patch(+6) — End-to-end model response acceptance

## Additional Relation Test
- Add `Implementation/e2e/pr14-model-task.spec.js` scenario that
  installs the real plugin package with explicitly approved grants,
  pairs a mocked legacy /agent socket, and submits a text prompt.
- Verify an actual WebSocket `task` frame carrying a UUID requestId
  (never infer dispatch from names in a diagnostic JSON object).
- Deliver `task_result` and terminal `task_status=completed` over
  the mock socket. Verify the isolated iframe displays returned text,
  the OCDA ModelTask activeId clears, and Cancel is disabled.
- This is a browser integration acceptance check, not evidence of
  real Windows Agent operation or live OpenAI inference.

## Security / scope
- Test text is synthetic. API keys are not stored in browser state,
  Hub Request payloads, diagnostics or the plugin iframe.
- Existing HubUnit, URU, OMU, EDPMU and editor core remain unchanged.
- No Explorer CRUD, PowerShell command, MCP or OAuth APIs are opened.

## CI state
Tests were committed; only mark PASS after latest-head Node/VTE,
Chromium and security workflow conclusions are green.
