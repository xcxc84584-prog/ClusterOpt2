# PR9 Patch(+9) — Native ConPTY health-check repair

## Root cause
Patch8 ran a JavaScript source string with
PowerShell's native-process argument marshalling:
`$NodePath -e $probe`.
On the user's Node.js v26.13.1 / Windows host the inner
quote characters were removed. Node received an invalid
`import(node-pty)` and `typeof m.spawn === function`,
causing a SyntaxError before the native addon could be tested.
Separately, npm 12 may skip node-pty's native install script
unless explicitly allowed.

## Changes
- Replace inline JavaScript with its own standalone
  Implementation/local-agent/probe-native.mjs file.
- Add the probe to the installer download list and run it by file
  path, without `-e`, shell eval or dynamic source interpolation.
- Pin node-pty to 1.1.0 in the local-agent manifest; approve only
  `node-pty@1.1.0` in `allowScripts`. No wildcard or all-script
  bypass.
- The installer runs npm install and npm rebuild node-pty before
  invoking the actual probe. Reject nonzero exit codes.
- The probe verifies the node-pty API and spawns a noninteractive
  Windows PowerShell via ConPTY; it rejects failure/timeout.
- LinkCore.SystemVersion is the sole release publisher and moves to
  0.0.9-pr9.patch9. Local agent and root package manifests mirror it.

## OCDA / Event Chain
Browser UI -> LinkCore SystemVersion -> downloaded CMD
 -> install-current.ps1 -> verified package manifest
 -> npm approved native build -> node probe-native.mjs
 -> actual ConPTY spawn and exit -> P/C/O loopback port selection
 -> detached authenticated Local Agent -> browser terminal.
The native installer runs outside browser HubUnit, so it does not
circumvent OMU/EHU/Request-Response permissions. Browser and
ConPTY authorization remain unchanged.

## Security, cost and tests
- Only the pinned node-pty install script is approved, rather than
  allowing arbitrary package lifecycle scripts.
- Probe runs no user command, contacts no endpoint and saves no
  credentials; it creates one short-lived Windows PowerShell with
  an 8-second timeout and closes on completion.
- Windows workflow validates PowerShell 5.1/7 syntax and, on Node
  26, installs and rebuilds node-pty then executes probe-native.mjs.
- Node OCDA tests assert no inline `node -e`, exact version pin
  and allowScripts, and downloaded probe presence.
- Real user's Windows background-agent pairing and interactive
  sessions still require manual acceptance.
