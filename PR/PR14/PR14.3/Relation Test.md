# PR14.3 Relation and browser tests

| Test | Expected | Execution status |
| --- | --- | --- |
| No plugin installed | No AI button/pane | Chromium case added |
| Manifest uiEntry path validated | 200 on valid folder | Node/VTE test updated |
| Unapproved package | 403 / no worker or UI | Chromium case added |
| Approved install | Worker 201 / UI appears | Chromium case added |
| Button location | Directly after PowerShell | Chromium case added |
| Button opens view | Visible plugin output pane | Chromium case added |
| zh-Hant labels | Correct native translations | Chromium case added |
| Switch global Language to en | Inline labels update | Chromium case added |
| Browser DOM isolation | Frame parent DOM denied | Chromium case added |
| Frame not connected to model | Task controls disabled | Chromium case added |
| Disable provider | Hide button and panel | Chromium case added |
| Re-enable provider | Restore button | Chromium case added |
| Uninstall provider | Button/pane removed | Chromium case added |
| Failed upgrade | Previous UI restored | Pending explicit E2E |
| UI injection adversarial | No host capability escalation | Pending targeted E2E |
| Cross-tab/PowerShell navigation | Pane hidden | Host handler present, E2E pending |
| UI style follows palette | Host wrapper only, iframe pending | Partial |
| VTE Log/EHU/Dependency | Existing Hub install lifecycle | Node fixture added |

IMPORTANT: "case added" does not mean PASS. Refer to exact GitHub
workflow runs at final commit for execution evidence.
