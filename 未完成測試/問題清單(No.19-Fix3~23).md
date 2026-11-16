# PR8 Patch19 Fix3 pending tests and issues

| ID | Priority | Condition |
| --- | --- | --- |
| 19F3.1 | P0 | Save progress reflects actual copy/readback bytes |
| 19F3.2 | P0 | Save does not block Workspace Activate |
| 19F3.3 | P0 | Tab switch back restores document Save percent |
| 19F3.4 | P0 | UI remains responsive with slow 65MiB writer |
| 19F3.5 | P0 | New Edit aborts pre-close writer, journal survives |
| 19F3.6 | P0 | Post-close verifies/retains checkpoint before edit |
| 19F3.7 | P0 | Blue progress 0–99 until Save verifies |
| 19F3.8 | P0 | EHU499/409/422/503 and 10/01 relation tests |
| 19F3.9 | P0 | Existing small-file Save/Close regression |
| 19F3.10 | P0 | Both final-head GitHub Actions CI all green |
| 19F3.11 | P0 | Verified previous-main rollback branch |
| 19F3.12 | P0 | Manual Windows file permission and OS locks |
| 20.1 | P1 | Continuous virtual scroll and parallel loading |
| 23.1 | P0 | 1GiB/5GiB write/restore performance acceptance |

Do not mark PR8 as PASS based on one 65MiB smoke test.
