# PR9 Patch(+6): Windows Local Agent installer ParserError

## Defect and cause
A user's downloaded setup CMD passed SystemVersion
0.0.9-pr9.patch5 to install-current.ps1.
The original downloaded PowerShell file had an unterminated
single-quoted version regex on line 2 and an entirely duplicated
installer body after the first agent startup. Windows PowerShell
5.1 failed to parse the script before executing any step.

## Corrections
- Rebuilt install-current.ps1 in one independent file with
  well-formed param() and ValidatePattern matching
  major.minor.patch-prN.patchN(.fixN) release names.
- Single implementation of Download-AgentFile, Find-Node,
  Install-PortableNode, Install-Dependencies and
  Select-LoopbackPort, each with explicit responsibilities.
- Installation resolves paths relative to USERPROFILE and discovered
  Node.js location; no hard-coded local file paths.
- Portable/system Node.js and adjacent npm.cmd/npm-cli.js supported.
- Never kills another process occupying port 43881; user must choose
  another port or cancel.
- Release identity still provided exclusively by LinkCore
  SystemVersion; UI -> CMD -> ExpectedVersion -> manifest check ->
  CLUSTEROPT_AGENT_VERSION -> /status.
- No API secrets, token constants or redirect of native agent
  pairing token to an installer stdout/stderr log.
- Agent token is displayed by its native console (interactive
  pairing); terminal operations remain separately authorized.
- Version updated to 0.0.9-pr9.patch6 for both manifests and LinkCore.

## Security and performance
- Installer downloads only the three release-matched agent files;
  compares package name and version before dependency installation.
- Network: Node.js LTS index/zip, repository sources and npm registry.
- Memory: small text/JSON source files plus Node archive;
  npm/node-pty native dependencies are handled by Node.
- Concurrency: setup serializes dependency installation before
  starting one separate agent; checks a free loopback port.
- No external code executes in the browser.

## Acceptance
- Windows PowerShell 5.1 and PowerShell 7 AST parse in
  .github/workflows/native-agent-parser.yml on PR and main.
- Unit regression rejects duplicated installer code, stale version,
  incorrect CMD source, unsafe process termination and logged token.
- Original OCDA Node/Playwright suite remains required.
- Real user's Windows native ConPTY run and pairing still requires
  user-machine acceptance; do not confuse parser PASS with full
  native terminal acceptance.
