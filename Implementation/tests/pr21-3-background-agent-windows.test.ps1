# PR21.3 BC acceptance: native Windows lifecycle and stale PID denial.
# Never print pairing tokens or credentials to CI logs.
$ErrorActionPreference = 'Stop'
$base = Join-Path $PSScriptRoot '../plugins/ai-agent-mcp/local-agent'
$manager = Join-Path $base 'Background-Agent.ps1'
$record = Join-Path $env:LOCALAPPDATA (
  'ClusterOpt2\AI-Agent-MCP\background-agent.json')
$token = Join-Path $env:LOCALAPPDATA (
  'ClusterTerminalAgent\pairing-token.dpapi')
$origin = 'https://xcxc84584-prog.github.io'
$original = $null
$started = $false

function Assert-True([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}

try {
  Assert-True (-not (Test-Path -LiteralPath $record)) (
    'A preexisting Agent record prevents isolated CI testing')
  & $manager -Action Start -Origin $origin | Out-Null
  $started = Test-Path -LiteralPath $record
  Assert-True $started 'Hidden local Agent did not start'
  Assert-True (Test-Path -LiteralPath $record) (
    'Identity record missing after successful start')
  Assert-True (Test-Path -LiteralPath $token) (
    'DPAPI-protected token missing after start')
  $stored = Get-Content -LiteralPath $token -Raw
  Assert-True ($stored.StartsWith('dpapi-v1:')) (
    'Token was not encrypted using the expected format')
  $identity = Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
  Assert-True ([int]$identity.pid -gt 4) 'Invalid native PID'
  Assert-True ([int]$identity.port -ge 1024) 'Invalid listener port'
  & $manager -Action Status | Out-Null
  $live = Get-NetTCPConnection -LocalPort ([int]$identity.port) -State Listen -ErrorAction SilentlyContinue
  Assert-True (@($live | Where-Object { $_.OwningProcess -eq [int]$identity.pid }).Count -gt 0) (
    'Status did not verify the running process')

  # Stale or tampered process records must never authorize termination.
  $original = Get-Content -LiteralPath $record -Raw
  $fake = $original | ConvertFrom-Json
  $fake.pid = $PID
  $fake | ConvertTo-Json | Set-Content -LiteralPath $record -Encoding UTF8
  $denied = $false
  try { & $manager -Action Stop *> $null } catch { $denied = $true }
  Assert-True $denied 'Stop accepted a tampered identity'
  $running = Get-Process -Id ([int]$identity.pid) -ErrorAction SilentlyContinue
  Assert-True ([bool]$running) 'Tampering killed the unrelated Agent process'

  Set-Content -LiteralPath $record -Value $original -Encoding UTF8
  $original = $null
  & $manager -Action Status | Out-Null
  $restored = Get-Process -Id ([int]$identity.pid) -ErrorAction SilentlyContinue
  Assert-True ([bool]$restored) 'Original process is missing'
  & $manager -Action Stop | Out-Null
  $started = $false
  Assert-True (-not (Test-Path -LiteralPath $record)) (
    'Identity record remained after stop')
  $listener = @(Get-NetTCPConnection -LocalPort ([int]$identity.port) -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq [int]$identity.pid })
  Assert-True ($listener.Count -eq 0) 'Listener remained after stop'
  Write-Host 'PR21.3 native Windows lifecycle PASS'
} finally {
  if ($original) {
    Set-Content -LiteralPath $record -Value $original -Encoding UTF8
  }
  if ($started -and (Test-Path -LiteralPath $record)) {
    try { & $manager -Action Stop *> $null } catch { }
  }
}
