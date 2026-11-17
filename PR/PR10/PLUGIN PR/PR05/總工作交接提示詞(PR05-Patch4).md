# ClusterOpt2 — PLUGIN PR05 Patch4 Final Handoff

PR10 / PLUGIN PR05 #46. Major branch plugin/pr05-route-transactions. Pre-PR05 main baseline e7ae73c8348f609c514d6fe033a37db48abc065a; backup/pre-plugin-pr05-20261117.

PR05.01–10 implement host-only route snapshots, CAS and atomic transactions, inflight version pinning, graceful provider draining, fail-closed fallback, bounded rollback, verified candidate rehydration and EHU/Log regression. ReleaseVersion.js is single product version authority; mirrors align to 0.0.11.

Verify exact-head 5/5 CI incl Chromium, create SHA-specific restore, and only then merge PR #46. Do not claim in-process forced cancellation, malicious Worker sandbox or 5GiB physical permission tests; these are deferred. Next PLUGIN PR06: Worker isolation, permissions, supply chain. Read this handoff, Plan/ArcD/Relation Test, global property registry and problem list before further changes.
