# Verify stale MCP recovery without terminating any live process.
$ErrorActionPreference = 'Stop'
$prior = $env:LOCALAPPDATA
$temp = Join-Path $env:TEMP ('cluster-mcp-stale-' + [guid]::NewGuid())
$env:LOCALAPPDATA = $temp
$manager = Join-Path $PSScriptRoot (
  '../plugins/ai-agent-mcp/local-agent/Background-Gateway.ps1')
$root = Join-Path $temp 'ClusterOpt2\AI-Agent-MCP'
$record = Join-Path $root 'gateway-mcp.json'
New-Item -ItemType Directory -Path $root -Force | Out-Null
function Assert([bool]$value, [string]$reason) {
  if (-not $value) { throw $reason }
}
try {
  # Absent record is a successful no-op, not a fatal setup failure.
  & $manager -Action StopMCP | Out-Null
  Assert (-not (Test-Path $record)) 'Missing record was recreated'
  # A nonexistent PID can be cleaned after explicit revocation.
  $expiredPid = 2147483000
  @{ pid = $expiredPid; port = 43880; exe = 'unused';
     started = 'unused'; signature = 'unused' } |
    ConvertTo-Json | Set-Content -LiteralPath $record -Encoding UTF8
  & $manager -Action StopMCP | Out-Null
  Assert (-not (Test-Path $record)) 'Expired record was not cleared'
  # An active but mismatched PID is NEVER killed or discarded.
  @{ pid = $PID; port = 43880; exe = 'unused';
     started = 'unused'; signature = 'unused' } |
    ConvertTo-Json | Set-Content -LiteralPath $record -Encoding UTF8
  $rejected = $false
  try { & $manager -Action StopMCP *> $null } catch {
    $rejected = $_.Exception.Message -match 'Unverified mcp PID'
  }
  Assert $rejected 'Live unverified PID was accepted'
  Assert (Test-Path $record) 'Active PID record was discarded'
  Assert ([bool](Get-Process -Id $PID -ErrorAction SilentlyContinue)) (
    'Current PowerShell process was terminated')
  Write-Host 'MCP stale record safety PASS'
} finally {
  $env:LOCALAPPDATA = $prior
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
