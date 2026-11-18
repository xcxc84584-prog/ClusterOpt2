param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+[a-z]?(?:-pr\d+\.patch\d+(?:\.fix\d+)?)?
    [string]$ExpectedVersion
)

# Version is provided by LinkCore.SystemVersion through the CMD.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$agentDir = Join-Path $env:USERPROFILE 'ClusterOpt2-Agent'
$base = 'https://raw.githubusercontent.com/xcxc84584-prog/' +
    'ClusterOpt2/main/Implementation/local-agent/'

function Download-AgentFile {
    param([string]$Uri, [string]$Destination)
    $fallback = $Uri.Replace(
        'raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/main/',
        'github.com/xcxc84584-prog/ClusterOpt2/raw/refs/heads/main/'
    )
    $failure = $null
    foreach ($candidate in @($Uri, $fallback)) {
        for ($attempt = 0; $attempt -lt 3; $attempt++) {
            try {
                $options = @{
                    Uri = $candidate
                    OutFile = $Destination
                    TimeoutSec = 45
                    UseBasicParsing = $true
                }
                Invoke-WebRequest @options
                if ((Get-Item $Destination).Length -lt 20) {
                    throw 'Downloaded file is incomplete'
                }
                return
            } catch {
                $failure = $_
                Start-Sleep -Seconds 2
            }
        }
    }
    throw ('Download failed: ' + $Uri + '; ' + $failure)
}

function Find-Node {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    $candidates = @()
    if ($command) { $candidates += $command.Source }
    if ($env:ProgramFiles) {
        $candidates += Join-Path $env:ProgramFiles 'nodejs\node.exe'
    }
    $candidates += Join-Path $agentDir 'node\node.exe'
    foreach ($path in $candidates) {
        if (-not (Test-Path $path)) { continue }
        try {
            $version = & $path --version
            $major = [int](($version -replace '^v', '').Split('.')[0])
            if ($LASTEXITCODE -eq 0 -and $major -ge 20) {
                return $path
            }
        } catch {
            continue
        }
    }
    return $null
}

function Install-PortableNode {
    $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $release = $index | Where-Object {
        $_.lts -and $_.files -contains 'win-x64-zip'
    } | Select-Object -First 1
    if (-not $release) { throw 'No Windows x64 Node.js LTS found' }
    $zip = Join-Path $agentDir 'node.zip'
    $uri = 'https://nodejs.org/dist/' + $release.version +
        '/node-' + $release.version + '-win-x64.zip'
    Download-AgentFile -Uri $uri -Destination $zip
    $extract = Join-Path $agentDir 'node-extract'
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $folder = Get-ChildItem $extract -Directory |
        Select-Object -First 1
    if (-not $folder) { throw 'Node.js extraction failed' }
    $destination = Join-Path $agentDir 'node'
    Copy-Item $folder.FullName $destination -Recurse -Force
    return Join-Path $destination 'node.exe'
}

function Install-Dependencies {
    param([string]$NodePath)
    $parent = Split-Path $NodePath
    $npmCmd = Join-Path $parent 'npm.cmd'
    $npmCli = Join-Path $parent 'node_modules\npm\bin\npm-cli.js'
    Push-Location $agentDir
    try {
        if (Test-Path $npmCmd) {
            & $npmCmd install --omit=dev --no-audit --no-fund
        } elseif (Test-Path $npmCli) {
            & $NodePath $npmCli install --omit=dev --no-audit --no-fund
        } else {
            throw 'npm is missing from the selected Node.js distribution'
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'Native node-pty dependencies failed to install'
        }
        # Existing npm installs may have skipped the native lifecycle.
        # Rebuild explicitly under the version-pinned allowScripts policy.
        if (Test-Path $npmCmd) {
            & $npmCmd rebuild node-pty --no-audit --no-fund
        } else {
            & $NodePath $npmCli rebuild node-pty --no-audit --no-fund
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'node-pty native rebuild failed'
        }
        # A real .mjs file prevents PowerShell from stripping quotes in
        # native command-line JavaScript and also checks ConPTY spawn.
        $probeFile = Join-Path $agentDir 'probe-native.mjs'
        if (-not (Test-Path -LiteralPath $probeFile)) {
            throw 'Missing local ConPTY probe file'
        }
        & $NodePath $probeFile
        if ($LASTEXITCODE -ne 0) {
            throw ('ConPTY native probe failed. Ensure node-pty was ' +
                'built for this Node.js version and Windows system.')
        }
    } finally {
        Pop-Location
    }
}

function Get-PortListeners {
    param([int]$Port)
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Release-OccupiedPort {
    param([int]$Port, [object[]]$Listeners)
    $processIds = @($Listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($processIds.Count -eq 0) {
        throw 'Cannot identify process occupying the port'
    }
    $owners = @()
    foreach ($ownerPid in $processIds) {
        if ($ownerPid -le 4 -or $ownerPid -eq $PID) {
            throw 'Refusing to terminate system or installer process'
        }
        $owner = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ownerPid)
        if (-not $owner -or -not $owner.Name -or -not $owner.CreationDate) {
            throw 'Cannot verify process identity'
        }
        $protectedNames = @(
            'System', 'Registry', 'Idle', 'smss.exe', 'csrss.exe',
            'wininit.exe', 'winlogon.exe', 'services.exe',
            'lsass.exe', 'svchost.exe', 'dwm.exe'
        )
        if ($protectedNames -contains $owner.Name) {
            throw ('Refusing to terminate protected process: ' + $owner.Name)
        }
        $ancestor = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)
        $ancestorIds = @()
        while ($ancestor -and $ancestor.ParentProcessId -gt 0) {
            $parentId = [int]$ancestor.ParentProcessId
            if ($ancestorIds -contains $parentId) { break }
            $ancestorIds += $parentId
            $ancestor = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $parentId) -ErrorAction SilentlyContinue
        }
        if ($ancestorIds -contains $ownerPid) {
            throw 'Refusing to terminate the parent shell'
        }
        $owners += $owner
    }
    Write-Warning ('Override may forcibly stop ' + $owners.Count + ' unrelated process(es).')
    foreach ($owner in $owners) {
        Write-Host ('PID ' + $owner.ProcessId + ': ' + $owner.Name)
        Write-Host ('  Path: ' + $owner.ExecutablePath)
    }
    $confirmation = Read-Host ('Type OVERRIDE to release port ' + $Port)
    if ($confirmation -cne 'OVERRIDE') {
        throw 'Override cancelled; no process was terminated'
    }
    foreach ($owner in $owners) {
        $ownerPid = [int]$owner.ProcessId
        $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ownerPid) -ErrorAction SilentlyContinue
        if (-not $current -or $current.CreationDate -ne $owner.CreationDate -or $current.Name -ne $owner.Name) {
            throw 'Port owner changed; override aborted'
        }
        $livePids = @(Get-PortListeners -Port $Port | Select-Object -ExpandProperty OwningProcess -Unique)
        if ($livePids -notcontains $ownerPid) {
            throw 'Port listener changed; override aborted'
        }
    }
    foreach ($owner in $owners) {
        Stop-Process -Id $owner.ProcessId -Force -ErrorAction Stop
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (@(Get-PortListeners -Port $Port).Count -eq 0) {
            Write-Host ('Port ' + $Port + ' released.')
            return
        }
        Start-Sleep -Milliseconds 250
    }
    throw 'Port still occupied; agent not started'
}

function Select-LoopbackPort {
    $port = 43881
    while ($true) {
        $listeners = @(Get-PortListeners -Port $port)
        if ($listeners.Count -eq 0) { return $port }
        Write-Host ('Port ' + $port + ' is occupied.')
        $choice = Read-Host '[P]ick another port / [C]ancel / [O]verride (force stop)'
        switch ($choice.Trim().ToUpperInvariant()) {
            'C' { throw 'Cancelled without stopping any process' }
            'P' {
                $value = Read-Host 'Enter TCP port (1024-65535)'
                $candidate = 0
                $valid = [int]::TryParse($value, [ref]$candidate)
                if (-not $valid -or $candidate -lt 1024 -or $candidate -gt 65535) {
                    Write-Warning 'Invalid TCP port'
                    continue
                }
                $port = $candidate
            }
            'O' {
                Release-OccupiedPort -Port $port -Listeners $listeners
            }
            default { Write-Warning 'Choose P, C or O' }
        }
    }
}
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
Write-Host '[1/5] Checking Node.js...'
$node = Find-Node
if (-not $node) { $node = Install-PortableNode }
$env:PATH = (Split-Path $node) + ';' + $env:PATH

Write-Host '[2/5] Downloading compatible agent files...'
foreach ($name in @('server.mjs', 'native-terminal.mjs', 'probe-native.mjs', 'package.json')) {
    $target = Join-Path $agentDir $name
    Download-AgentFile -Uri ($base + $name) -Destination $target
}
$manifest = Get-Content (Join-Path $agentDir 'package.json') -Raw |
    ConvertFrom-Json
if ($manifest.name -ne 'clusteropt2-local-agent' -or
    $manifest.version -ne $ExpectedVersion) {
    throw ('Agent release mismatch: expected ' + $ExpectedVersion +
        '; received ' + $manifest.version)
}

Write-Host '[3/5] Installing dependencies...'
Install-Dependencies -NodePath $node
Write-Host '[4/5] Selecting available port...'
$port = Select-LoopbackPort
$env:CLUSTEROPT_PORT = [string]$port
$env:CLUSTEROPT_AGENT_VERSION = $ExpectedVersion

Write-Host '[5/5] Launching detached native Local Agent...'
# A fresh cryptographic token is printed ONCE to this installer window.
# No token file, redirected output or persistent browser storage is created.
$tokenBytes = New-Object byte[] 32
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($tokenBytes) } finally { $generator.Dispose() }
$pairingToken = [BitConverter]::ToString($tokenBytes).Replace('-', '').ToLowerInvariant()
$env:CLUSTEROPT_PAIRING_TOKEN = $pairingToken
$start = @{
    FilePath = $node
    ArgumentList = @('server.mjs')
    WorkingDirectory = $agentDir
    WindowStyle = 'Hidden'
    PassThru = $true
}
try {
    $agent = Start-Process @start
} finally {
    Remove-Item Env:CLUSTEROPT_PAIRING_TOKEN -ErrorAction SilentlyContinue
}
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    if ($agent.HasExited) { throw 'Local Agent exited unexpectedly' }
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if (@($listeners | Where-Object { $_.OwningProcess -eq $agent.Id }).Count -gt 0) {
        $ready = $true
        break
    }
}
if (-not $ready) { throw 'Local Agent failed to open its loopback port' }
Write-Host ('Agent port: ' + $port)
Write-Host ('Agent version: ' + $ExpectedVersion)
Write-Host ('PAIRING TOKEN (copy privately): ' + $pairingToken)
Write-Host 'Local Agent will keep running after this window closes.'
Read-Host 'Copy the port and token, then press ENTER to close this installer' | Out-Null
$pairingToken = $null
exit 0
)]
    [string]$ExpectedVersion
)

# Version is provided by LinkCore.SystemVersion through the CMD.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$agentDir = Join-Path $env:USERPROFILE 'ClusterOpt2-Agent'
$base = 'https://raw.githubusercontent.com/xcxc84584-prog/' +
    'ClusterOpt2/main/Implementation/local-agent/'

function Download-AgentFile {
    param([string]$Uri, [string]$Destination)
    $fallback = $Uri.Replace(
        'raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/main/',
        'github.com/xcxc84584-prog/ClusterOpt2/raw/refs/heads/main/'
    )
    $failure = $null
    foreach ($candidate in @($Uri, $fallback)) {
        for ($attempt = 0; $attempt -lt 3; $attempt++) {
            try {
                $options = @{
                    Uri = $candidate
                    OutFile = $Destination
                    TimeoutSec = 45
                    UseBasicParsing = $true
                }
                Invoke-WebRequest @options
                if ((Get-Item $Destination).Length -lt 20) {
                    throw 'Downloaded file is incomplete'
                }
                return
            } catch {
                $failure = $_
                Start-Sleep -Seconds 2
            }
        }
    }
    throw ('Download failed: ' + $Uri + '; ' + $failure)
}

function Find-Node {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    $candidates = @()
    if ($command) { $candidates += $command.Source }
    if ($env:ProgramFiles) {
        $candidates += Join-Path $env:ProgramFiles 'nodejs\node.exe'
    }
    $candidates += Join-Path $agentDir 'node\node.exe'
    foreach ($path in $candidates) {
        if (-not (Test-Path $path)) { continue }
        try {
            $version = & $path --version
            $major = [int](($version -replace '^v', '').Split('.')[0])
            if ($LASTEXITCODE -eq 0 -and $major -ge 20) {
                return $path
            }
        } catch {
            continue
        }
    }
    return $null
}

function Install-PortableNode {
    $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
    $release = $index | Where-Object {
        $_.lts -and $_.files -contains 'win-x64-zip'
    } | Select-Object -First 1
    if (-not $release) { throw 'No Windows x64 Node.js LTS found' }
    $zip = Join-Path $agentDir 'node.zip'
    $uri = 'https://nodejs.org/dist/' + $release.version +
        '/node-' + $release.version + '-win-x64.zip'
    Download-AgentFile -Uri $uri -Destination $zip
    $extract = Join-Path $agentDir 'node-extract'
    Expand-Archive -Path $zip -DestinationPath $extract -Force
    $folder = Get-ChildItem $extract -Directory |
        Select-Object -First 1
    if (-not $folder) { throw 'Node.js extraction failed' }
    $destination = Join-Path $agentDir 'node'
    Copy-Item $folder.FullName $destination -Recurse -Force
    return Join-Path $destination 'node.exe'
}

function Install-Dependencies {
    param([string]$NodePath)
    $parent = Split-Path $NodePath
    $npmCmd = Join-Path $parent 'npm.cmd'
    $npmCli = Join-Path $parent 'node_modules\npm\bin\npm-cli.js'
    Push-Location $agentDir
    try {
        if (Test-Path $npmCmd) {
            & $npmCmd install --omit=dev --no-audit --no-fund
        } elseif (Test-Path $npmCli) {
            & $NodePath $npmCli install --omit=dev --no-audit --no-fund
        } else {
            throw 'npm is missing from the selected Node.js distribution'
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'Native node-pty dependencies failed to install'
        }
        # Existing npm installs may have skipped the native lifecycle.
        # Rebuild explicitly under the version-pinned allowScripts policy.
        if (Test-Path $npmCmd) {
            & $npmCmd rebuild node-pty --no-audit --no-fund
        } else {
            & $NodePath $npmCli rebuild node-pty --no-audit --no-fund
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'node-pty native rebuild failed'
        }
        # A real .mjs file prevents PowerShell from stripping quotes in
        # native command-line JavaScript and also checks ConPTY spawn.
        $probeFile = Join-Path $agentDir 'probe-native.mjs'
        if (-not (Test-Path -LiteralPath $probeFile)) {
            throw 'Missing local ConPTY probe file'
        }
        & $NodePath $probeFile
        if ($LASTEXITCODE -ne 0) {
            throw ('ConPTY native probe failed. Ensure node-pty was ' +
                'built for this Node.js version and Windows system.')
        }
    } finally {
        Pop-Location
    }
}

function Get-PortListeners {
    param([int]$Port)
    return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Release-OccupiedPort {
    param([int]$Port, [object[]]$Listeners)
    $processIds = @($Listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    if ($processIds.Count -eq 0) {
        throw 'Cannot identify process occupying the port'
    }
    $owners = @()
    foreach ($ownerPid in $processIds) {
        if ($ownerPid -le 4 -or $ownerPid -eq $PID) {
            throw 'Refusing to terminate system or installer process'
        }
        $owner = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ownerPid)
        if (-not $owner -or -not $owner.Name -or -not $owner.CreationDate) {
            throw 'Cannot verify process identity'
        }
        $protectedNames = @(
            'System', 'Registry', 'Idle', 'smss.exe', 'csrss.exe',
            'wininit.exe', 'winlogon.exe', 'services.exe',
            'lsass.exe', 'svchost.exe', 'dwm.exe'
        )
        if ($protectedNames -contains $owner.Name) {
            throw ('Refusing to terminate protected process: ' + $owner.Name)
        }
        $ancestor = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $PID)
        $ancestorIds = @()
        while ($ancestor -and $ancestor.ParentProcessId -gt 0) {
            $parentId = [int]$ancestor.ParentProcessId
            if ($ancestorIds -contains $parentId) { break }
            $ancestorIds += $parentId
            $ancestor = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $parentId) -ErrorAction SilentlyContinue
        }
        if ($ancestorIds -contains $ownerPid) {
            throw 'Refusing to terminate the parent shell'
        }
        $owners += $owner
    }
    Write-Warning ('Override may forcibly stop ' + $owners.Count + ' unrelated process(es).')
    foreach ($owner in $owners) {
        Write-Host ('PID ' + $owner.ProcessId + ': ' + $owner.Name)
        Write-Host ('  Path: ' + $owner.ExecutablePath)
    }
    $confirmation = Read-Host ('Type OVERRIDE to release port ' + $Port)
    if ($confirmation -cne 'OVERRIDE') {
        throw 'Override cancelled; no process was terminated'
    }
    foreach ($owner in $owners) {
        $ownerPid = [int]$owner.ProcessId
        $current = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ownerPid) -ErrorAction SilentlyContinue
        if (-not $current -or $current.CreationDate -ne $owner.CreationDate -or $current.Name -ne $owner.Name) {
            throw 'Port owner changed; override aborted'
        }
        $livePids = @(Get-PortListeners -Port $Port | Select-Object -ExpandProperty OwningProcess -Unique)
        if ($livePids -notcontains $ownerPid) {
            throw 'Port listener changed; override aborted'
        }
    }
    foreach ($owner in $owners) {
        Stop-Process -Id $owner.ProcessId -Force -ErrorAction Stop
    }
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (@(Get-PortListeners -Port $Port).Count -eq 0) {
            Write-Host ('Port ' + $Port + ' released.')
            return
        }
        Start-Sleep -Milliseconds 250
    }
    throw 'Port still occupied; agent not started'
}

function Select-LoopbackPort {
    $port = 43881
    while ($true) {
        $listeners = @(Get-PortListeners -Port $port)
        if ($listeners.Count -eq 0) { return $port }
        Write-Host ('Port ' + $port + ' is occupied.')
        $choice = Read-Host '[P]ick another port / [C]ancel / [O]verride (force stop)'
        switch ($choice.Trim().ToUpperInvariant()) {
            'C' { throw 'Cancelled without stopping any process' }
            'P' {
                $value = Read-Host 'Enter TCP port (1024-65535)'
                $candidate = 0
                $valid = [int]::TryParse($value, [ref]$candidate)
                if (-not $valid -or $candidate -lt 1024 -or $candidate -gt 65535) {
                    Write-Warning 'Invalid TCP port'
                    continue
                }
                $port = $candidate
            }
            'O' {
                Release-OccupiedPort -Port $port -Listeners $listeners
            }
            default { Write-Warning 'Choose P, C or O' }
        }
    }
}
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
Write-Host '[1/5] Checking Node.js...'
$node = Find-Node
if (-not $node) { $node = Install-PortableNode }
$env:PATH = (Split-Path $node) + ';' + $env:PATH

Write-Host '[2/5] Downloading compatible agent files...'
foreach ($name in @('server.mjs', 'native-terminal.mjs', 'probe-native.mjs', 'package.json')) {
    $target = Join-Path $agentDir $name
    Download-AgentFile -Uri ($base + $name) -Destination $target
}
$manifest = Get-Content (Join-Path $agentDir 'package.json') -Raw |
    ConvertFrom-Json
if ($manifest.name -ne 'clusteropt2-local-agent' -or
    $manifest.version -ne $ExpectedVersion) {
    throw ('Agent release mismatch: expected ' + $ExpectedVersion +
        '; received ' + $manifest.version)
}

Write-Host '[3/5] Installing dependencies...'
Install-Dependencies -NodePath $node
Write-Host '[4/5] Selecting available port...'
$port = Select-LoopbackPort
$env:CLUSTEROPT_PORT = [string]$port
$env:CLUSTEROPT_AGENT_VERSION = $ExpectedVersion

Write-Host '[5/5] Launching detached native Local Agent...'
# A fresh cryptographic token is printed ONCE to this installer window.
# No token file, redirected output or persistent browser storage is created.
$tokenBytes = New-Object byte[] 32
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($tokenBytes) } finally { $generator.Dispose() }
$pairingToken = [BitConverter]::ToString($tokenBytes).Replace('-', '').ToLowerInvariant()
$env:CLUSTEROPT_PAIRING_TOKEN = $pairingToken
$start = @{
    FilePath = $node
    ArgumentList = @('server.mjs')
    WorkingDirectory = $agentDir
    WindowStyle = 'Hidden'
    PassThru = $true
}
try {
    $agent = Start-Process @start
} finally {
    Remove-Item Env:CLUSTEROPT_PAIRING_TOKEN -ErrorAction SilentlyContinue
}
$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250
    if ($agent.HasExited) { throw 'Local Agent exited unexpectedly' }
    $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
    if (@($listeners | Where-Object { $_.OwningProcess -eq $agent.Id }).Count -gt 0) {
        $ready = $true
        break
    }
}
if (-not $ready) { throw 'Local Agent failed to open its loopback port' }
Write-Host ('Agent port: ' + $port)
Write-Host ('Agent version: ' + $ExpectedVersion)
Write-Host ('PAIRING TOKEN (copy privately): ' + $pairingToken)
Write-Host 'Local Agent will keep running after this window closes.'
Read-Host 'Copy the port and token, then press ENTER to close this installer' | Out-Null
$pairingToken = $null
exit 0
