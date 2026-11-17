# Local Agent listener with shared C/P/O port selection.
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[^/?#]+$')]
  [string]$Origin
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Port-CPO.ps1')
$node = Get-Command node.exe -ErrorAction Stop
$npm = Get-Command npm.cmd -ErrorAction Stop
Push-Location $PSScriptRoot
try {
  & $npm.Source install --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
  $selected = Select-ServicePort 'terminal'
  $env:CLUSTER_TERMINAL_ORIGIN = $Origin
  $env:CLUSTER_TERMINAL_PORT = [string]$selected
  Write-Host ("Local Agent port: {0}" -f $selected)
  Write-Host 'Use this port in the trusted browser pairing dialog.'
  & $node.Source (Join-Path $PSScriptRoot 'server.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Local Agent failed' }
} finally {
  Pop-Location
}
