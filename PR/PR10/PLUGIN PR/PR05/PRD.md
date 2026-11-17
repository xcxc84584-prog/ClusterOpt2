# PLUGIN PR05 — Route Transactions

PR05.01–10 functionality completed in candidate branch: immutable generation snapshot; host-only Begin/Validate/Commit; CAS; request version; graceful Provider draining; fail-closed; rollback; runtime rehydrate; EHU and concurrency regression. PR05.05 does not force-terminate arbitrary JS; worker isolation is PR06.

## Final PR05.10 release Gate
Atomic route generations, validated candidate transactions, CAS, inflight source binding, graceful Provider drain, revalidated rollback, runtime transaction rehydrate, EHU/Log/Dependency regression and CI. Release 0.0.11 as single major PR. Real file permission/5GiB physical tests and untrusted plugin Worker termination are deferred to subsequent major PRs. No second registration authority or public mutation API.
