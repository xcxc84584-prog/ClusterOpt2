# PR12 Patch +2 — Browser regression repairs and release gate

## Regression failures resolved
First browser run: 93 passed, 6 failed.
- New marketplace tests incorrectly attempted to click #pluginBtn
  while the Tool menu was closed. The tests now open File > Tool first.
- Old Patch19/PR4 tests still expected native window.confirm, while
  PR12 uses explicit Yes / No and Escape to keep the document open.
- Updated browser tests for explicit Yes=Save, No=Discard, Escape=Abort.
- Existing PR4 unit tests likewise align with the requested new
  close semantics.

After corrections on commit ba3900e804074e01619eeb665626d3f15a17faa2:
- OCDA CI: success
- PR1 OCDA Verification: success
- PLUGIN PR03 Provider Registry: success
- Local Agent PowerShell Parse: success

## Release preparation
- Canonical ReleaseVersion.product = 0.0.14; nextRelease 0.0.15.
- Root package and local-agent package both mirror 0.0.14.
- index.html CSS/JS cache tags bumped to pr12-marketplace-release.
- No new parallel/shadow plugin registries; HubUnit remains authority.
- Pending final CI checks on release commit, then restore node and merge.

## Limitations
Only byte-identical reviewed bundled JS can be mounted.
This does not imply a general untrusted plugin sandbox.
