# PR14.5 Patch(+1) — Model Provider and Task Pipeline

## New
- Implementation/object/PluginModelTaskObject.js
- Implementation/property/PluginModelTaskPolicy.js
- Implementation/tests/pr14-model-task.test.js
- Implementation/e2e/pr14-model-task.spec.js

## Extended
- PluginLocalAgentPolicy: model/task incoming reply validation.
- PluginLocalAgentObject: host-owned model key dialog and transport
  for providerSet/providerGet/taskStart/taskCancel; task results routed
  through HubUnit to the Model Task Object.
- PluginUIHostUnit: registers/unregisters Model Task Object and limits
  model actions to declared, approved plugin UI requests.
- PluginPermissionPolicy and plugin.json: explicit independent grants
  model.configure and model.task.
- index.html and locale JSON: model settings, text input, status/output
  and cancellation UI.
- Prior PR14 tests: update required grant fixtures.

## Fixes
- Corrected PR14.4 Chromium race by waiting for asynchronous ping
  before examining messages.
- Corrected host model credential validation regex.
- Strict source check: ingest and reset are LocalAgent-origin only.

## Limits
No provider key is embedded in repository code. User keys are handled
only in the live trusted host modal and the local Agent, which currently
stores its configuration according to the old Agent implementation.
Real inference not claimed until end-to-end tests.
