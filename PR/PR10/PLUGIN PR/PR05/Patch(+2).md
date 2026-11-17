# PR05 Patch2 — PR05.04, 06–10 candidate

- Route inflight generation pinning with finally decrement and awaitRouteDrain Promise; safe old request completion during hot route switch.
- No implicit fallback on inactive Provider: fail-closed remains inherited from PR04 and explicitly regression-tested.
- Bounded route rollback history (8 generations), CAS guard and full revalidation of historical Provider availability; rollback itself increments the generation.
- Reload clears candidate transactions; stale generation and EHU events tested; repeated swaps / history pressure tested.
- PR05.05 cancellation of already running third-party requests is NOT implemented; awaitRouteDrain only observes in-flight completion. Do not mark PR05.05 PASS.
- CI pending exact-head; no merge or version bump.
