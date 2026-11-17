# PR04 Patch(+8.fix1) — Ownership and Cycle Regression

- Strengthen DAG test so input/output contracts are compatible and rejection truly exercises the dependency cycle guard.
- Ensure an owned update cannot erase a preexisting host-controlled route that targets foreign Providers in the caller scope.
- No new APIs, extra CI workflow, release bump or main merge.
- Re-run the five existing exact-head verification workflows before recording PASS.
