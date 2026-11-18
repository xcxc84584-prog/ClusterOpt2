# PR20.2 Plan — MCP Bootstrap diagnostics and clusteropt2 hostname

## PRD
Windows screenshot confirms MCP-Quick-Setup.cmd stopped at stage 1/3 with no useful filename or network error. Keep one standalone CMD, preserve existing ports and CPO policy. Set canonical public service name to `clusteropt2`, but require an actual DNS-valid HTTPS hostname for OAuth.

## Plan
- Pin the bootstrap downloads to previously merged, verified commit `9e9055421f6b0d6c021297b28deedbee964b526a`, confirmed to contain all five gateway launcher/source files.
- Replace nested CMD FOR/PowerShell download with a single PowerShell foreach command to avoid Windows CMD grouping pitfalls; display exact URL, name and exception when download fails.
- Require the public OAuth HTTPS hostname's first DNS label to be `clusteropt2`. The user must supply an owned full DNS name and reverse proxy; no arbitrary external domain or fictitious HTTPS endpoint should be claimed as deployed.
- Preserve Local Agent 43881, MCP 43880, OAuth 43879 and existing separate `cluster.read` / `cluster.control` authorization.
- Node contract tests and complete GitHub CI before merge.

## Security and load
No new privileges or unattended shell access. One process fetches five small files sequentially; downloaded sources are commit-pinned and errors fail closed. The public hostname configuration does not create a Cloudflare tunnel, DNS record, or TLS certificate automatically. Ensure no credentials are written to repository/UI.
