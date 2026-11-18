# User-scoped hidden Local Agent lifecycle (no admin service required).
# Start/Stop never terminates an unverified process or arbitrary port owner.
param(
  [ValidateSet('Start','Stop','Status','Token')]
  [string]$Action = 'Status',
  [ValidatePattern('^https://[^/?#]+$')]
  [string]$Origin = 'https://xcxc84584-prog.github.io'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Port-CPO.ps1')
$recordPath = Join-Path $env:LOCALAPPDATA (
  'ClusterOpt2\AI-Agent-MCP\background-agent.json')
$scriptPath = Join-Path $PSScriptRoot 'server.cjs'

function Read-Record {
  if (-not (Test-Path -LiteralPath $recordPath)) { return $null }
  return (Get-Content -LiteralPath $recordPath -Raw |
    ConvertFrom-Json -ErrorAction Stop)
}
function Process-Fingerprint([int]$ProcessId) {
  $item = Get-CimInstance Win32_Process -Filter (
    'ProcessId=' + $ProcessId) -ErrorAction SilentlyContinue
  if (-not $item -or -not $item.CreationDate -or
      -not $item.ExecutablePath -or -not $item.CommandLine) {
    return $null
  }
  return $item
}
function Verify-Agent($record) {
  if (-not $record -or -not $record.pid -or
      -not $record.started -or -not $record.exe -or
      -not $record.port -or
      [int]$record.port -lt 1024 -or [int]$record.port -gt 65535) {
    return $null
  }
  $item = Process-Fingerprint ([int]$record.pid)
  if (-not $item) { return $null }
  $started = $item.CreationDate.ToUniversalTime().ToString('o')
  $expectedScript = [IO.Path]::GetFullPath($scriptPath)
  if ($started -cne [string]$record.started -or
      $item.ExecutablePath -ine [string]$record.exe -or
      $item.CommandLine.IndexOf($expectedScript,
        [StringComparison]::OrdinalIgnoreCase) -lt 0) {
    return $null
  }
  $owners = @(Listeners ([int]$record.port) |
    Where-Object { $_.OwningProcess -eq [int]$record.pid })
  if ($owners.Count -eq 0) { return $null }
  return $item
}
function Show-Token {
  Add-Type -AssemblyName System.Security
  $file = Join-Path $env:LOCALAPPDATA (
    'ClusterTerminalAgent\pairing-token.dpapi')
  if (-not (Test-Path -LiteralPath $file)) {
    throw 'No DPAPI-protected pairing token was found.'
  }
  $raw = (Get-Content -LiteralPath $file -Raw).Trim()
  if (-not $raw.StartsWith('dpapi-v1:')) {
    throw 'Protected pairing token has an invalid format.'
  }
  $bytes = [Convert]::FromBase64String($raw.Substring(9))
  $value = [Security.Cryptography.ProtectedData]::Unprotect(
    $bytes, $null,
    [Security.Cryptography.DataProtectionScope]::CurrentUser)
  $token = [Text.Encoding]::UTF8.GetString($value)
  if ($token -cnotmatch '^[a-f0-9]{64}$') {
    throw 'Protected pairing token has invalid content.'
  }
  $saved = Read-Record
  if (-not (Verify-Agent $saved)) {
    throw 'Cannot display pairing endpoint: Agent is not verified.'
  }
  Write-Host ('PORT MASSAGE : ' + $saved.port + ' : ' + $token +
    ' (ws://127.0.0.1:' + $saved.port + '/agent)')
}
switch ($Action) {
  'Token' { Show-Token; break }
  'Status' {
    $saved = Read-Record
    if (Verify-Agent $saved) {
      Write-Host ('Active pairing port: {0}' -f $saved.port)
      Write-Host ('Local Agent running: PID {0}, port {1}' -f
        $saved.pid, $saved.port)
    } else {
      Write-Host 'Local Agent not running (or identity mismatch).'
    }
    break
  }
  'Stop' {
    $saved = Read-Record
    $item = Verify-Agent $saved
    if (-not $item) {
      # A previously saved PID may have exited. Clear its stale record
      # only if there is no process with that PID. Never kill an unknown PID.
      $oldPid = 0
      if ($saved -and $saved.pid -and
          [int]::TryParse([string]$saved.pid, [ref]$oldPid) -and
          $oldPid -gt 0) {
        $stillExists = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($stillExists) {
          throw ('Agent PID ' + $oldPid +
            ' exists but does not match the saved identity. ' +
            'Refusing to stop or discard the record.')
        }
      }
      if (-not $saved) {
        Write-Host 'No previous Local Agent record to revoke.'
        break
      }
      Remove-Item -LiteralPath $recordPath -Force -ErrorAction Stop
      Write-Host 'Expired Local Agent record removed; no process stopped.'
      break
    }
    # Last-moment revalidation prevents a stale PID from being targeted.
    if (-not (Verify-Agent $saved)) {
      throw 'Agent process identity changed.'
    }
    Stop-Process -Id ([int]$saved.pid) -Force -ErrorAction Stop
    Remove-Item -LiteralPath $recordPath -Force
    Write-Host 'Local Agent stopped.'
    break
  }
  'Start' {
    $existing = Read-Record
    if (Verify-Agent $existing) {
      Write-Host ('Local Agent already running on port {0}' -f
        $existing.port)
      break
    }
    $node = Get-Command node.exe -ErrorAction Stop
    $port = Select-ServicePort 'terminal'
    $env:CLUSTER_TERMINAL_ORIGIN = $Origin
    $env:CLUSTER_TERMINAL_PORT = [string]$port
    # Capture stderr in an isolated temporary file. Without this, a
    # hidden Node process can fail immediately with no useful diagnostic.
    $diagnosticPath = Join-Path $env:TEMP (
      'cluster-agent-start-' + [guid]::NewGuid().ToString('N') + '.err')
    $child = $null
    $ready = $false
    try {
      $child = Start-Process -FilePath $node.Source -WorkingDirectory (
        $PSScriptRoot) -ArgumentList ('"' + $scriptPath + '"') `
        -RedirectStandardError $diagnosticPath `
        -WindowStyle Hidden -PassThru -ErrorAction Stop
      for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 250
        $owners = @(Listeners $port | Where-Object {
          $_.OwningProcess -eq $child.Id
        })
        if ($owners.Count -gt 0) { $ready = $true; break }
        $child.Refresh()
        if ($child.HasExited) { break }
      }
      if (-not $ready) {
        $detail = ''
        if (Test-Path -LiteralPath $diagnosticPath) {
          $detail = (Get-Content -LiteralPath $diagnosticPath -Raw `
            -ErrorAction SilentlyContinue)
        }
        # Never repeat credentials or arbitrary output from the agent.
        # Show only actionable, fixed diagnostic categories.
        $reason = if ($detail -match 'node-pty|pty\\.node|MODULE_NOT_FOUND') {
          'node-pty native module failed; approve and rebuild install scripts.'
        } elseif ($detail -match 'EADDRINUSE') {
          'Port was occupied when Node attempted to bind.'
        } elseif ($detail -match 'DPAPI|credential protection') {
          'Windows credential protection failed under this user account.'
        } elseif ($detail -match 'CLUSTER_TERMINAL_ORIGIN') {
          'Agent origin configuration is invalid.'
        } elseif ($child.HasExited) {
          'Node exited with code ' + $child.ExitCode + '.'
        } else {
          'Node did not open the expected listener.'
        }
        throw ('Local Agent failed to bind on port ' + $port +
          ' (PID ' + $child.Id + '): ' + $reason)
      }
    } finally {
      Remove-Item -LiteralPath $diagnosticPath -Force `
        -ErrorAction SilentlyContinue
    }
    $item = Process-Fingerprint ([int]$child.Id)
    if (-not $item) { throw 'Cannot verify Agent process identity.' }
    $state = @{
      pid = [int]$child.Id
      port = [int]$port
      exe = [string]$item.ExecutablePath
      started = $item.CreationDate.ToUniversalTime().ToString('o')
    }
    $folder = Split-Path -Parent $recordPath
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
    $temporary = $recordPath + '.new'
    $json = $state | ConvertTo-Json
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($temporary, $json, $utf8)
    Move-Item -LiteralPath $temporary -Destination $recordPath -Force
    Write-Host 'Local Agent started; use -Action Token to show pairing details.'
    break
  }
}
