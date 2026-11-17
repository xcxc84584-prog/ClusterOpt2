# ClusterOpt2 — PLUGIN PR04 Patch5 Handoff

## Status
Working major: PR10 / PLUGIN PR04 (Draft, no main merge).
PR04.01–03 already accepted. PR04.04 Chain / PR04.05 Fan-out
submitted together on the same major branch; check exact-head CI and
establish restore checkpoint before accepting either.
Next: PR04.06 Observe, followed by Response Pipeline, route ACL,
preview and final regression/major restore gate.

## Mandatory before next implementation
Read this file, 全域屬性清單.md, 未完成測試／問題清單(No.1~20).md,
current PR04 PRD, Plan, ArcD, Relation Test, Patch(+4)/Patch(+5).
Review the actual related GitHub upstream and current source.
SOP PRD -> Plan -> ArcD -> Implementation + Relation Test -> Project.

## Architecture
One URU Provider authority; HubUnit owns in-memory route config,
dispatch and authorization. RouteContractPolicy validates JSON-compatible
payloads and schema types, with capped depth and size. Chain forwards
one output sequentially; fanout aggregates results in provider order
and rejects partial branch failure. Existing HubUnit.request enforces
UserAPI/AgentAPI, AccessPolicy, scheduling, OMU EHU/Log/Dependency.
No untrusted plugin installation, runtime Worker sandbox or route ACL.
No unbounded concurrency and no hard timeout guarantee in current mode.

## Long-term L3 syntax highlighting
Generalize grammar Provider by programming-language ID and grammar
version; support many languages independently of UI zh-Hant/en locale.
Plain text is safe fallback. No plugin may modify original document
text outside validated decoration contract.

## Version and release
ReleaseVersion.js is the only product version source. Do not modify
package.json directly. One merge after complete major PR04 gate only.
Maintain per-PR04 restore branch and avoid redundant CI triggers.
Manual 5GiB and browser File System Access acceptance remains separate.
