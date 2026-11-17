# PLUGIN PR04 — Plan

## PR04.01 — Service Request Resolver
Input: registered source, canonical Service ID, action, payload, options.
Output: unmodified HubUnit.request result. Invalid selector => 400;
missing or disabled Service/action => 404; multiple candidates => 409.

## Reviewed GitHub upstream
- VS Code extension commands and language-id contribution contracts:
  https://github.com/microsoft/vscode-docs/blob/main/api/references/contribution-points.md
- Eclipse Theia architecture (frontend/backend and injection):
  https://github.com/eclipse-theia/theia-website/blob/master/src/docs/architecture.md
- Monaco language grammars and tokenizer separation (future PR10):
  https://github.com/microsoft/monaco-editor

## Improvement
Resolve only from the URU-owned Provider index, projected by the existing
ServiceRegistry. Never select by registration order if ambiguous.
Use existing HubUnit.request for all authorization, origin-scoped
UserAPI/AgentAPI, scheduler, EHU/Log and Dependency. New logical route
entry does NOT grant additional authority or invoke Provider factories.
Legacy source/target/action requests remain fully functional.

## Complexity, security and operations
The resolver scans active candidates for one Service, with Provider
actions capped by PR03 limits. No persistent index, new shared Property,
new DOM controls, new file access or uncontrolled parallel execution.
No outside Object receives an untrusted source identity.

## CI / release
Reuse existing CI with per-PR concurrency supersession; the Node and
Chromium test files enter existing standard suites. No duplicate PR04
workflow is necessary at this stage. Five latest-head workflows must
PASS before PR04.01 acceptance. No release version changes while Draft.
