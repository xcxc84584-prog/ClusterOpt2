# PR22.3 Patch(+1)

- PluginShellApprovalObject: no per-command modal after a trusted
  ToolBox grant; recheck root, PS right, source and capability on
  every command. Log SessionApproved; deny on revoked/mismatched scope.
- PluginUIHostUnit: clearly label PowerShell auto-run and warn that
  subsequent commands execute without additional prompts.
- Shell approval tests: deny default, repeated auto-run, no confirm,
  invalid origin/path and revocation.
- LocalAgent dispatch tests: opening PowerShell UI after PS grant,
  and rejecting opening when PS permission is absent.

Physical Windows Gateway and Chromium browser test still needed.
Main remains the restoration baseline.
