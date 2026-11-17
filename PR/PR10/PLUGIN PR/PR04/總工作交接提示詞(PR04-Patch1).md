# ClusterOpt2 — PLUGIN PR04 Patch1 Handoff

## Progress and branches
Major PLUGIN PR04; small PR04.01 implemented in Draft branch
plugin/pr04-service-routing, not yet merged into main.
PR03 merged 26736f858b2f0875589e53c3db6d946833b50c0c.
Rollback before PR04: backup/pre-plugin-pr04-20261117 (same SHA).

## Mandatory OCDA reads before each implementation
Read this file, the root 全域屬性清單.md and
未完成測試／問題清單(No.1~20).md, plus PR04/PRD.md,
Plan.md, ArcD.md, Relation Test.md, and latest Patch(+n).md.
SOP: PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.
Study relevant upstream GitHub projects before each new small PR.

## PR04.01 architecture
ServiceRequestResolver consults URU via ServiceRegistry (one authority).
HubUnit.requestService preserves original source, action, origin, payload
and options by delegating to HubUnit.request. One active match => 200;
none => 404; malformed => 400; ambiguity => 409.
No new Property or browser API, no silent Provider choice. PR04.02 next:
Route Table schema with ACL and bounded validation.

## Future multilingual code highlighting
L3 syntax highlighting must support multiple programming languages
through language-ID keyed grammar Providers, not a two-language-only
tokenizer. Plain-text fallback, explicit grammar/version/language IDs.
Keep UI translation locale separate from source code language detection.

## Release / CI
ReleaseVersion.js is canonical; product remains 0.0.9-pr9.patch9,
package.json mirrored. No draft release bump or unified release dispatch.
Existing CI concurrency cancels superseded runs within each workflow;
avoid adding a redundant PR04 workflow. Verify all five latest-head
workflow results and VTE/Chromium cases before marking PASS.
Do not merge major PR04 until PR04.01–10 are individually accepted.

## Safety
No machine paths or secrets. No claim of physical 5GiB editor testing,
outside Worker runtime isolation or manual browser File System API PASS.
