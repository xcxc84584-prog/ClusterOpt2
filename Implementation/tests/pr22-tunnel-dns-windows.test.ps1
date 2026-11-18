# Offline smoke test: DNS diagnostics must not publish or contact OAuth.
$ErrorActionPreference = 'Stop'
$prior=$env:LOCALAPPDATA
$env:LOCALAPPDATA=Join-Path $env:TEMP (
  'cluster-tunnel-test-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $env:LOCALAPPDATA -Force | Out-Null
try {
  . (Join-Path $PSScriptRoot (
    '../plugins/ai-agent-mcp/local-agent/Background-Gateway.ps1')) `
    -Action Status | Out-Null
  $result=Test-PublicDns 'localhost'
  if($result -ne 'local-ok'){
    throw ('Local DNS diagnostic expected local-ok, got '+$result)
  }
  # Never assert public *.trycloudflare.com availability on a CI runner.
  # Registration detection and DNS verification are separate stages.
  Write-Host 'Tunnel DNS local diagnostic PASS'
} finally {
  Remove-Item -LiteralPath $env:LOCALAPPDATA -Force -Recurse `
    -ErrorAction SilentlyContinue
  $env:LOCALAPPDATA=$prior
}
