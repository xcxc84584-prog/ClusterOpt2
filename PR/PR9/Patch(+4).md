# PR9 Patch(+4) — Final audit / PowerShell release compatibility

## Verified defect
- Legacy PSM eyebrow still labeled LOCAL CONNECTION · v0.0.69.
- Downloaded setup CMD was v0.0.64-r2, downloading installer from
  xcxc84584-prog/ClusterOpt old repository rather than ClusterOpt2.
- The old install helper could stop an unrelated process on port
  43881 using a force action, which is unacceptable in the new flow.

## Implementation
- Inject LinkCore SystemVersion into legacy mountPowerShellUI.
  No duplicate mutable version state is introduced.
- Generate CMD filename and displayed title from this version and
  download install-current.ps1 from ClusterOpt2 main.
- Vendor old server.mjs, native-terminal.mjs and package.json into
  Implementation/local-agent; adapt installer to a separate
  ClusterOpt2-Agent user home folder.
- Installation preserves other listeners, supports choosing a different
  port or cancel, and sets CLUSTEROPT_AGENT_VERSION on the new agent.
- /status returns the agent version; PowerShellManager requires exact
  match before reporting Connected. Old agents display mismatch and
  must be reinstalled for this version.
- Versioned package release metadata; Node and browser checks cover
  generated CMD, version propagation, origin/token rejection and
  old-repo URLs.
- All terminal commands still cross the explicitly paired local-only
  ConPTY bridge; this is not a browser-internal shell implementation.

## Security and load
- No keys or tokens shipped in source.
- Agent listens on 127.0.0.1, requires matching Origin and bearer
  token, with websocket pairing and max 8 native sessions.
- No automatic kill of unrelated port listeners.
- Existing upstream legacy agent files are isolated in their own
  directory; project-owned changes continue to follow OCDA lint.

## Known limitations
- Installation downloads packages from Node/npm, needs internet and
  a compatible native node-pty build on Windows.
- Real Windows launch, agent token lifecycle, hard reload, and
  1/5 GiB stress/performance tests are not supplied by Linux CI.
- Existing PR8 P0s and PR9 global line seek, Explorer parity and
  full UI pixel comparison remain open.
- This patch is not a PR8/PR9 overall PASS.
