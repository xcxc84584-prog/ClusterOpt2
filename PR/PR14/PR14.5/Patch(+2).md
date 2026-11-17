# PR14.5 Patch(+2) — Contract hardening and regression alignment

## Fixed
- Tightened the OCDA Task Object so `ingest/reset` accept only
  `PluginLocalAgentObject` as the registered sender. Direct UI
  and unregistered providers cannot forge model status/results.
- Corrected host-only model credential input regular expressions,
  preserving the legacy Agent's bounded `sk-...` and model ID format.
- Aligned the `modelInfo` UI event name to the host route.
- Updated earlier PR14.3 UI tests after enabling the model/task
  interface, avoiding stale "AI unavailable" text assertions.
- Updated the actual installable plugin README and bilingual copy.
- Added Node/VTE and Chromium model/task tests.

## Security
- `model.configure` and `model.task` remain independent from
  `network.request` and `local-agent.pair`.
- API keys never pass through Hub Requests, iframe or Worker.
- Legacy Windows Agent local at-rest key storage is **unverified**;
  do not claim that it is encrypted.
- Prompt content is sent to Hub as bounded data but not recorded in
  EHU/Log; model outputs are bounded and delivered to isolated UI.
- No browser storage of credentials and no shell/file/MCP capabilities.

## CI / acceptance
The preceding PR14.4 Chromium failure was a race reading a sent
Ping too early; test now waits for asynchronous dispatch. Check all
workflows at final commit. Real Windows Agent / provider inference
remains untested in this runtime.
