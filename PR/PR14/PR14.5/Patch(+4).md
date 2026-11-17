# PR14.5 Patch(+4) — Task active state projection

## Browser test evidence
- Chromium PR14.5 test sent task messages successfully but the
  cancel button remained disabled. Prior run: 117 PASS, 1 FAIL.
- This is a UI state synchronization issue, not a permission bypass.

## Fix
- Generic PluginUIHostUnit includes one non-sensitive boolean
  `taskActive` in the host-mediated model response. It is projected
  from the actual registered ModelTaskObject.activeId, rather than
  guessed from independent iframe event timing.
- Plugin HTML updates submit/cancel control state from this host
  response, while retaining asynchronous model task statuses.
- API keys, prompts and model output are not included in the host
  activity projection.

## Acceptance
Re-run real Chromium and VTE tests on final commit. No main merge.
Windows local provider key security remains unresolved.
