# Shared C/P/O startup port resolver; no automatic process termination.
$ErrorActionPreference = 'Stop'
$script:Defaults = @{ terminal = 43881; mcp = 43880; oauth = 43879 }
$script:ConfigPath = Join-Path $env:LOCALAPPDATA 'ClusterOpt2\AI-Agent-MCP\service-ports.json'
$script:Protected = @('System','Registry','Idle','smss.exe','csrss.exe','wininit.exe','winlogon.exe','services.exe','lsass.exe','svchost.exe','dwm.exe')
function Listeners([int]$Port) {
  return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}
function SafeOwner([int]$OwnerPid, [int]$Port) {
  if ($OwnerPid -le 4 -or $OwnerPid -eq $PID) {
    throw 'Refusing current or system process'
  }
  $ancestor = Get-CimInstance Win32_Process -Filter "ProcessId=$PID"
  while ($ancestor -and $ancestor.ParentProcessId -gt 0) {
    if ($ancestor.ParentProcessId -eq $OwnerPid) { throw 'Parent process is protected' }
    $ancestor = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ancestor.ParentProcessId)
  }
  $owner = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $OwnerPid)
  if (-not $owner -or -not $owner.CreationDate -or -not $owner.ExecutablePath -or $script:Protected -contains $owner.Name) {
    throw 'Cannot verify safe process identity'
  }
  if (@(Listeners $Port | Where-Object { $_.OwningProcess -eq $OwnerPid }).Count -eq 0) {
    throw 'Listener changed'
  }
  return $owner
}
function OverrideListener([int]$Port) {
  $pids = @(Listeners $Port | Select-Object -ExpandProperty OwningProcess -Unique)
  if ($pids.Count -eq 0) { return }
  $owners = @($pids | ForEach-Object { SafeOwner $_ $Port })
  Write-Warning 'O can terminate another application; review executable paths.'
  foreach ($owner in $owners) {
    Write-Host ('PID {0}: {1} | {2}' -f $owner.ProcessId,$owner.Name,$owner.ExecutablePath)
  }
  if ((Read-Host 'Type OVERRIDE to confirm') -cne 'OVERRIDE') {
    throw 'Override cancelled'
  }
  foreach ($owner in $owners) {
    $current = SafeOwner ([int]$owner.ProcessId) $Port
    if ($current.CreationDate -ne $owner.CreationDate -or
        $current.ExecutablePath -ne $owner.ExecutablePath) {
      throw 'Process identity changed'
    }
  }
  foreach ($owner in $owners) { Stop-Process -Id $owner.ProcessId -Force }
  for ($i = 0; $i -lt 20; $i++) {
    if (@(Listeners $Port).Count -eq 0) { return }
    Start-Sleep -Milliseconds 250
  }
  throw 'Port remains occupied'
}
function Get-ServicePorts {
  $ports = @{}
  foreach ($key in $script:Defaults.Keys) { $ports[$key] = [int]$script:Defaults[$key] }
  if (Test-Path -LiteralPath $script:ConfigPath) {
    $saved = Get-Content -LiteralPath $script:ConfigPath -Raw | ConvertFrom-Json
    foreach ($key in $script:Defaults.Keys) {
      $value = $saved.$key
      if ($null -ne $value -and "$value" -match '^[0-9]{4,5}$' -and
          [int]$value -ge 1024 -and [int]$value -le 65535) {
        $ports[$key] = [int]$value
      }
    }
  }
  return $ports
}
function Save-ServicePort([string]$Service, [int]$Port) {
  $ports = Get-ServicePorts
  $ports[$Service] = $Port
  $parent = Split-Path -Parent $script:ConfigPath
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  $temp = $script:ConfigPath + '.new'
  $ports | ConvertTo-Json | Set-Content -LiteralPath $temp -Encoding UTF8
  Move-Item -LiteralPath $temp -Destination $script:ConfigPath -Force
}
function Select-ServicePort([string]$Service) {
  if (-not $script:Defaults.ContainsKey($Service)) { throw 'Unknown service' }
  $ports = Get-ServicePorts
  $port = [int]$ports[$Service]
  while ($true) {
    $reserved = @($ports.Keys | Where-Object {
      $_ -ne $Service -and [int]$ports[$_] -eq $port
    })
    $busy = @(Listeners $port)
    if ($reserved.Count -eq 0 -and $busy.Count -eq 0) {
      Save-ServicePort $Service $port
      return $port
    }
    Write-Warning ("{0}: port {1} unavailable" -f $Service,$port)
    if ($reserved.Count -gt 0) {
      Write-Host ('Reserved by: ' + ($reserved -join ', '))
    }
    $choice = (Read-Host '[C]ancel / [P]ick port / [O]verride').Trim().ToUpperInvariant()
    switch ($choice) {
      'C' { throw 'Cancelled without stopping a process' }
      'P' {
        $value = Read-Host 'Port (1024-65535)'
        $candidate = 0
        if (-not [int]::TryParse($value,[ref]$candidate) -or
            $candidate -lt 1024 -or $candidate -gt 65535) {
          Write-Warning 'Invalid port'
        } else { $port = $candidate }
      }
      'O' {
        if ($reserved.Count -gt 0) {
          Write-Warning 'Cannot override another configured service'
        } else { OverrideListener $port }
      }
      default { Write-Warning 'Choose C, P, or O' }
    }
  }
}


# Displays a bounded candidate range, never a full-system port sweep.
# "Available" means no current TCP LISTEN socket and no other
# Cluster service reservation; Windows may still refuse a future bind.
function Show-PortInventory(
  [string]$Phase = 'STATUS',
  [string]$PairService = 'terminal'
) {
  $ports = Get-ServicePorts
  $first = 43875
  $last = 43900
  $range = @($first..$last)
  $range += @($ports.Values | ForEach-Object { [int]$_ })
  $range = @($range | Sort-Object -Unique)
  $active = @()
  try {
    $active = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
      Where-Object { $range -contains [int]$_.LocalPort })
  } catch {
    Write-Warning 'TCP listener enumeration unavailable; ports are unknown.'
  }
  $available = @()
  $occupied = @()
  $reserved = @()
  foreach ($port in $range) {
    $matches = @($active | Where-Object {
      [int]$_.LocalPort -eq $port
    })
    $owners = @($ports.Keys | Where-Object {
      [int]$ports[$_] -eq $port
    } | Sort-Object)
    $pids = @($matches | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($pids.Count -gt 0) {
      $occupied += ('{0}(PID:{1})' -f $port,($pids -join ','))
    } elseif ($owners.Count -gt 0) {
      $reserved += ('{0}({1})' -f $port,($owners -join ','))
    } else {
      $available += [string]$port
    }
  }
  Write-Host ('=== CLUSTER PORTS / '+$Phase+' ===')
  foreach ($service in @('terminal','mcp','oauth')) {
    $label = if ($service -eq 'terminal') {'Agent Pairing'} else {
      $service.ToUpperInvariant()
    }
    Write-Host ('{0} configured port: {1}' -f $label,$ports[$service])
  }
  Write-Host ('Pairing port ({0}): {1}' -f $PairService,$ports[$PairService])
  Write-Host ('Candidate range: {0}-{1} plus configured ports' -f
    $first,$last)
  Write-Host ('Available (no observed listener): '+
    $(if ($available.Count) {$available -join ', '} else {'none'}))
  Write-Host ('Occupied (TCP listeners): '+
    $(if ($occupied.Count) {$occupied -join ', '} else {'none'}))
  Write-Host ('Reserved (configured, not listening): '+
    $(if ($reserved.Count) {$reserved -join ', '} else {'none'}))
  Write-Host '=============================='
}
