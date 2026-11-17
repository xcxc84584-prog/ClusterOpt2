# PR13 Patch(+8) — lifecycle/data consistency and browser security tests

## Goal and risk
Complete additional PR13.6 correctness work and extend PR13.7
adversarial verification without introducing a second plugin registry.

## Changes
- Host lifecycle upgrades reject cutover if active dependents would
  lose their only live Provider, even when the replacement retains the
  same service ID. Return HTTP-like 409 and OMU EHU.
- Plugin Manager now persists a newly upgraded user package **only after
  activation succeeds**, preserving the older stored snapshot on failure.
- Successful uninstall removes saved user package data in addition to
  current URU registration and sandbox handles.
- VTE test: deny upgrade when an active Provider depends on the target.
- Chromium browser test: CSP blocks network fetch and parent localStorage
  access from inside an opaque-origin plugin sandbox.

## EventChain
1. Update -> inspect import -> explicit consent -> Hub/URU dependency gate
   -> install replacement -> persist new snapshot (failure reports warning).
2. Remove -> Hub/URU unregister -> sandbox terminate -> IndexedDB delete.
3. Sandboxed network attempt -> CSP connect-src none -> rejected fetch;
   parent localStorage access denied by opaque origin.
4. Dependency-blocked update -> OMU EHU 409 -> existing runtime and
   registered version remain untouched.

## Tests and limitations
- All previous PR13.6 workflow checks passed at commit eb9052d.
- New Patch(+8) CI and browser security test results must be observed
  before marking this patch PASS.
- Persisted custom package bytes are inert after reload: execution always
  requires fresh explicit consent (no permission replay).
- Full project HTML UI and arbitrary relative ES imports are still not
  executable; staged/exported resources are data-only.
- No hard CPU timeout guarantee for same-process synchronous loops.
- The update transaction does not offer zero-downtime cutover; blocking
  dependent Providers mitigates but does not eliminate this gap.
- PR13.7/13.8 overall acceptance is NOT achieved by this patch.

## Recovery and release
PR #58 remains Draft. Base recovery:
backup/pr13-prestart-20261117.
Previous checkpoint: backup/pr13-patch7-draft-20261117.
No unified release version bump, no merge to main until all P0 gates pass.
