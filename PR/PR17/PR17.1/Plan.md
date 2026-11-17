# PR17.1 — Standalone Windows Agent Setup and Port Recovery

User evidence: Quick-Setup.cmd installed local dependencies, then port 43879
was already occupied. npm warned that node-pty installation scripts were
not approved. Reference: Implementation/local-agent/install-current.ps1.

Requirements:
- Single downloadable CMD, not a full ZIP for initial Agent setup
- P = select alternate TCP port, C = cancel without stopping process
- O = verify owner PID/name/creation time, require explicit OVERRIDE,
  then re-check ownership before any Stop-Process call
- Bind only to 127.0.0.1, no hardcoded secrets or absolute user paths
- Trusted pairing dialog must support selected port
- Handle npm native node-pty script approval with explicit consent

Risks: a forced O stop may terminate unrelated programs; no automatic O.
Network bootstrap obtains immutable-revision files from the project repo.
Old main and current plugins remain usable; no unrelated core changes.
