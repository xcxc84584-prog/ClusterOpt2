# PLUGIN PR05 ArcD

Host → LinkCore → HubUnit → RouteTransactionUnit → existing RouteTablePolicy, RouteControlPolicy, Provider registry. HubUnit alone swaps immutable route snapshots, increments generation and logs EHU. All configured routes retain existing authorization. Event chain: Begin → Validate (dry-run) → CAS Commit / 409 or Abort. Runtime transaction candidates are discarded on reload.

## Patch2 — Inflight and bounded rollback

PR05.04: keep routeVersion pinned synchronously before async work, retain generation-specific in-flight counts and wait for drain without modifying API envelopes. PR05.05: route drain tracking is implemented but cancellation/unregister gating remains pending. PR05.06: explicitly regression-test fail-closed 404 for disabled Provider. PR05.07: bounded immutable history, revalidate rollback under CAS and always generate a new version. PR05.08: test runtime reload clears pending candidates. PR05.09/10: EHU and repeated-version pressure regression. No new workflow, no browser mutation API.

## Patch3 — Draining and validated rehydrate
PR05.05: Provider-level selected-request pinning, explicit disable-then-drain-and-unregister, reject direct Provider/Object unregister while selected in-flight. Does not pretend to forcibly terminate already executing JS; PR06 Worker time budgets remain separate. PR05.08: host can rehydrate an approved candidate via Begin/Validate/Commit; no untrusted persistence. Negative impersonation and concurrent removal regression added.
