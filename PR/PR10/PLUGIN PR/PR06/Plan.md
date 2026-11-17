# PLUGIN PR06 Plan

## Patch1 PR06.01/02/05
Review Comlink postMessage RPC and Eclipse Theia plugin host architecture. Keep one URU Provider authority and HubUnit REQ/REP. Introduce independent bounded JSON-data validation and narrow manifest permission allowlist; grants stored only in runtime PluginPermissionUnit, not in persisted Manifest. Legacy Provider registration unchanged; no default grants. Owner-only grant/revoke, privileged host approval and core-deny.

## Threat model
Untrusted scripts can try DOM access, direct fetch, File Handle transfer, permission escalation, prototype pollution, postMessage replay, oversized payload, or denial of service. A same-origin Worker does NOT prevent network access, so unreviewed source execution is blocked until PR06.04 isolation and PR06.07 integrity. Never accept code/data URLs as plugin sources.

## Performance
Permission checks O(1); message validation O(bytes) bounded to 64 KiB, depth 8 and 128 children; grants bound to URU provider lifecycle. No modified File I/O or editor UI.

## Upstream reviewed
- https://github.com/GoogleChromeLabs/comlink/blob/main/README.md
- https://github.com/eclipse-theia/theia/blob/master/README.md

## Patch2 — Worker transport and budget
- TrustedPluginWorkerUnit creates only the fixed bundled worker module. One request per Worker and a global active limit of 8; timeout range 10–5000ms; terminate on success, error, malformed reply, or timeout. No user code, Worker URL, or dynamic import.
- PluginSourcePolicy denies any non-builtin source. This fail-closed policy is NOT a secure third-party sandbox; same-origin Workers can access fetch and are unsafe for arbitrary code.
- Compare GoogleChromeLabs/comlink message RPC and Theia plugin host boundaries. Keep Hub ownership/URU Provider authority; only registered worker isolation manifests can enter this trusted execution path. Avoid affecting file pipeline.

## Patch3 Provenance and adversarial testing
Use a bounded 1MiB Uint8Array snapshot and SHA-256 verified against a trusted pre-pinned expected digest. This detects modification but is not signer authenticity; no execution on success. Probe invalid digest, mutable bytes, crafted message prototypes, forged RPC results, and timeouts. Check EHU is status-only without payload secrets. User consent UI and strong origin separation remain future gate.

## Patch4 — Four-page Plugin Manager
The user-approved sketch is implemented as four separate views: Plugin List, Plugin Permission, API List, EHU Log. Existing slice budget/highlighter/processor/committer control remains reachable through Plugin Tool. URU provides only live registration data; OMU provides EHU; permissions are read-only plus already-authorized revocation, never synthetic grants. PR06.08 approval ceremony remains separate and NOT complete. Responsive layout and Playwright real browser verification required.

## PR06.08 Consent Patch
A user-visible modal now allows explicit session-only grant decisions on each permission; denial creates no grant, revoke removes active grant. The modal rechecks URU Provider identity and exact Manifest reference before approval and requires a trusted click. This is only an application Host consent path: same-origin arbitrary plugin execution stays permanently blocked by PluginSourcePolicy; isolated-origin third-party sandbox remains a separate pending requirement.
