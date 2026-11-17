# PR14.8: opt-in local service startup; no elevated privileges.
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[^/]+$')]
  [string]$Origin
)
$ErrorActionPreference = 'Stop'
$command = Get-Command node.exe -ErrorAction Stop
$npm = Get-Command npm.cmd -ErrorAction Stop
$agentDir = $PSScriptRoot
Push-Location $agentDir
try {
  & $npm.Source install --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
  $env:CLUSTER_TERMINAL_ORIGIN = $Origin
  & $command.Source (Join-Path $agentDir 'server.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Agent process failed' }
} finally {
  Pop-Location
}
