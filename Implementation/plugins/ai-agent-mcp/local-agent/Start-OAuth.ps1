# OAuth loopback listener; HTTPS proxy must be configured by the user.
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[^/?#]+$')]
  [string]$Issuer
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Port-CPO.ps1')
$ports = Get-ServicePorts
Show-PortInventory -Phase 'BEFORE OAUTH START' -PairService 'terminal'
$selected = Select-ServicePort 'oauth'
$env:CLUSTER_OAUTH_PORT = [string]$selected
$env:CLUSTER_MCP_PORT = [string]$ports.mcp
$env:CLUSTER_OAUTH_ISSUER = $Issuer
$node = Get-Command node.exe -ErrorAction Stop
Write-Host ("OAuth port: {0}; MCP port: {1}" -f $selected,$ports.mcp)
Show-PortInventory -Phase 'SELECTED PORT / BEFORE BIND' -PairService 'terminal'
Write-Host 'Service is starting in foreground; listener status follows.'
& $node.Source (Join-Path $PSScriptRoot 'oauth-mcp-gateway.cjs')
Show-PortInventory -Phase 'AFTER OAUTH EXIT' -PairService 'terminal'
if ($LASTEXITCODE -ne 0) { throw 'OAuth gateway failed' }
