# PR14.8: externally supplied HTTPS issuer; no automatic public tunnel.
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://[^/?#]+$')]
  [string]$Issuer
)
$ErrorActionPreference = 'Stop'
$node = Get-Command node.exe -ErrorAction Stop
$env:CLUSTER_OAUTH_ISSUER = $Issuer
& $node.Source (Join-Path $PSScriptRoot 'oauth-mcp-gateway.cjs')
if ($LASTEXITCODE -ne 0) { throw 'OAuth gateway failed' }
