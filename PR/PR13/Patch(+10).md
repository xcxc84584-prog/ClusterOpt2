# PR13 Patch(+10) — Browser acceptance and deterministic OPFS test

## Status
PR13.7 browser hardening now executes user-authored self-contained
ES Modules in a classic dedicated Worker created inside an opaque-origin
sandboxed iframe. The iframe retains the authenticated host MessagePort
and relays RPC messages to the Worker over an inner MessageChannel.
Worker.onerror relays a 502 failure rather than silently timing out.
This preserves effective HubUnit ACL and URU identity per invocation.

## Verification from preceding commit
- Commit 5c1bf915: OCDA CI Node/VTE/ACD: PASS.
- Commit 5c1bf915: OCDA CI Chromium: 106/106 PASS.
- PR1 verifier browser: 105/106 PASS; old Explorer PR8+25 OPFS
  immediate-read race failed once with NotFoundError.
- PR1 Node and PLUGIN PR02/PR03/Local Agent workflows: PASS.

## Fix
- The PR8+25 Explorer test now polls native OPFS state after the
  asynchronous UI create-file action, tolerating NotFoundError only
  during the bounded Playwright expect.poll window.
- The product code is unchanged by this test-only follow-up.

## EventChain / EHU
- User Plugin -> HubUnit -> URU state and permission gate -> opaque
  iframe MessagePort -> inner MessagePort -> dedicated Worker -> REP.
- Worker synchronous infinite loop -> host timeout 504, terminate
  frame and dedicated Worker, OMU EHU.
- Worker load error -> iframe retained host port -> 502, OMU EHU.
- Explorer create file -> async OPFS write -> UI and OPFS state;
  browser test waits for committed native file before asserting.

## Outstanding release gates
- Full arbitrary multi-file relative ES module import graph.
- Full sandboxed HTML/CSS/JS UI rendering from a folder.
- Persistent activation consent/integrity review after reload,
  tested across browsers; no unattended untrusted auto-execution.
- All major PR13 acceptance tests and unified version release backup.

Keep PR #58 Draft until all required features pass. No main merge.
