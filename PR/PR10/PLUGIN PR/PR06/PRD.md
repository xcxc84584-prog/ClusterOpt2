# PLUGIN PR06 — Security Runtime

## Scope
PR06.01 Trust/Threat Model, PR06.02 Manifest permissions, PR06.05 structured payload policy delivered in Patch1. PR06.03–04/06–10 still required before untrusted plugin runtime can be enabled. Existing host service routing remains intact.

## Non-negotiable boundary
A manifest claim is never a grant. Host-run grant records are volatile; privileged access requires explicit approval; core operations can never be delegated. No File Handle or DOM access to external providers. Same-origin Workers must not be treated as secure untrusted sandboxes.

## Patch2 Scope
PR06.03/04/06 candidate: approved, application-shipped trusted Worker operations only; messages are bounded and cloned; source policy rejects external/remote/blob/code URLs. Worker is same origin and cannot provide arbitrary third-party isolation. PR06.07–10 and cross-origin sandbox are pending.
