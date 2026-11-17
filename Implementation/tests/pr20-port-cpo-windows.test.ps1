$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot '..\plugins\ai-agent-mcp\local-agent'
$priorLocalAppData = $env:LOCALAPPDATA
$env:LOCALAPPDATA = Join-Path $env:TEMP ('cluster-cpo-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $env:LOCALAPPDATA -Force | Out-Null
try {
  . (Join-Path $root 'Port-CPO.ps1')
  $ports = Get-ServicePorts
  if ($ports.terminal -ne 43881 -or
      $ports.mcp -ne 43880 -or
      $ports.oauth -ne 43879) {
    throw 'Default port map mismatch'
  }

  # Never query or stop a real process during the test.
  $script:SimulateBusy = $false
  function Get-NetTCPConnection {
    param($LocalPort, $State, $ErrorAction)
    if ($script:SimulateBusy -and $LocalPort -eq 43880) {
      return [pscustomobject]@{ OwningProcess = 56789 }
    }
    return @()
  }
  $port = Select-ServicePort 'terminal'
  if ($port -ne 43881) { throw 'Local Agent selection failed' }

  # C must stop immediately without touching a process.
  $script:SimulateBusy = $true
  $script:Responses = @('C')
  function Read-Host {
    param($Prompt)
    $answer = $script:Responses[0]
    $script:Responses = @($script:Responses | Select-Object -Skip 1)
    return $answer
  }
  $cancelled = $false
  try { $null = Select-ServicePort 'mcp' }
  catch { $cancelled = $_.Exception.Message -match 'Cancelled' }
  if (-not $cancelled) { throw 'C did not cancel' }

  # P chooses a new free port and persists it for downstream services.
  $script:Responses = @('P','44080')
  $port = Select-ServicePort 'mcp'
  if ($port -ne 44080 -or (Get-ServicePorts).mcp -ne 44080) {
    throw 'P did not persist selected port'
  }

  # Test O with a fake listener, fake identity and explicit decline.
  $script:Responses = @('O','NO')
  $script:Stopped = $false
  function SafeOwner {
    param([int]$OwnerPid,[int]$Port)
    return [pscustomobject]@{
      ProcessId = $OwnerPid
      Name = 'test-only.exe'
      ExecutablePath = 'test-only.exe'
      CreationDate = '2026-01-01'
    }
  }
  function Stop-Process {
    param($Id,$Force)
    $script:Stopped = $true
  }
  $denied = $false
  try { $null = Select-ServicePort 'oauth' }
  catch { $denied = $_.Exception.Message -match 'Cancelled' }
  # OAuth uses 43879 (unoccupied), so directly exercise override instead.
  $script:Responses = @('NO')
  try { OverrideListener 43880 }
  catch { $denied = $_.Exception.Message -match 'cancelled' }
  if (-not $denied -or $script:Stopped) {
    throw 'O cancelled incorrectly or stopped without consent'
  }
  Write-Host 'PR20 C/P/O mock tests PASS'
} finally {
  $env:LOCALAPPDATA = $priorLocalAppData
}
