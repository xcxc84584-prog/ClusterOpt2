# AI Agent MCP(ChatGPT) standalone CMD bootstrap helper.
param(
  [ValidatePattern('^[a-f0-9]{40}$|^main$')]
  [string]$SourceRevision = 'main'
)
$ErrorActionPreference = 'Stop'
$origin = 'https://xcxc84584-prog.github.io'
$agentDir = Join-Path $env:LOCALAPPDATA 'ClusterOpt2\AI-Agent-MCP'
$remoteRoot = 'https://raw.githubusercontent.com/' +
  'xcxc84584-prog/ClusterOpt2/' + $SourceRevision +
  '/Implementation/plugins/ai-agent-mcp/local-agent/'
function Find-Node {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { return $null }
  $version = & $node.Source -p 'process.versions.node'
  if ($LASTEXITCODE -ne 0) { return $null }
  if ([int]($version.Split('.')[0]) -lt 20) { return $null }
  return $node
}
function Ensure-Node {
  $node = Find-Node
  if ($node) { return $node }
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) { throw 'Install Node.js 20+ and reopen CMD.' }
  if ((Read-Host 'Install Node.js LTS using winget? [Y/N]') -notmatch '^[Yy]$') {
    throw 'Node.js installation declined'
  }
  & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw 'Node.js installation failed' }
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') +
    ';' + [Environment]::GetEnvironmentVariable('Path','User')
  $node = Find-Node
  if (-not $node) { throw 'Reopen CMD after Node.js installation' }
  return $node
}
function Ensure-Files {
  New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
  foreach ($name in @('server.cjs','secure-store.cjs',
      'package.json','Port-CPO.ps1','Background-Agent.ps1')) {
    $target = Join-Path $agentDir $name
    # Refresh reviewed code to prevent stale Agent binaries after upgrades.
    $temp = $target + '.download'
    try {
      Invoke-WebRequest -UseBasicParsing -Uri ($remoteRoot + $name) -OutFile $temp -TimeoutSec 45
      if ((Get-Item -LiteralPath $temp).Length -lt 20) { throw 'Incomplete file download' }
      Move-Item -LiteralPath $temp -Destination $target -Force
    } finally {
      Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
    }
  }
}
# Existing local Agent state needs an explicit user decision.
# Reuse does not rotate the protected pairing credential.
$agentRecord = Join-Path $agentDir 'background-agent.json'
$existingAgent = Test-Path -LiteralPath $agentRecord
$agentDecision = 'N'
if ($existingAgent) {
  Write-Warning 'An existing Local Agent background record was found.'
  $oldManager = Join-Path $agentDir 'Background-Agent.ps1'
  if (Test-Path -LiteralPath $oldManager) {
    & $oldManager -Action Status
  }
  Write-Host '[R] Reuse existing Agent and pairing token.'
  Write-Host '[D] Stop the verified old Agent before reinstalling.'
  Write-Host '[C] Cancel, keeping the previous Agent unchanged.'
  do {
    $agentDecision = (Read-Host 'Choose R/D/C').Trim().ToUpperInvariant()
  } while ($agentDecision -notin @('R','D','C'))
  if ($agentDecision -eq 'C') { exit 0 }
  if ($agentDecision -eq 'D') {
    Write-Host 'Existing DPAPI pairing token will be preserved.'
    if ((Read-Host 'Confirm restart? Type RESTART') -cne 'RESTART') {
      exit 0
    }
    # The previous installer can leave a JSON record after the PID exits.
    # Its manager might not include the newer stale-record cleanup yet.
    $saved = Get-Content -LiteralPath $agentRecord -Raw |
      ConvertFrom-Json -ErrorAction Stop
    $savedPid = 0
    $hasPid = $saved.pid -and
      [int]::TryParse([string]$saved.pid, [ref]$savedPid) -and
      $savedPid -gt 0
    $present = if ($hasPid) {
      Get-Process -Id $savedPid -ErrorAction SilentlyContinue
    } else { $null }
    if (-not $present) {
      Remove-Item -LiteralPath $agentRecord -Force -ErrorAction Stop
      Write-Host 'Expired Agent record removed; no process was terminated.'
    } else {
      if (-not (Test-Path -LiteralPath $oldManager)) {
        throw 'Cannot verify a running previous Agent; refusing to stop.'
      }
      & $oldManager -Action Stop
      if (-not $?) { throw 'Could not stop the verified previous Agent' }
    }
  }
}

Write-Host 'AI AGENT MCP(ChatGPT) - local setup'
Write-Host ('Source: ' + $SourceRevision)
$node = Ensure-Node
Ensure-Files
$npm = Get-Command npm.cmd -ErrorAction Stop
Push-Location $agentDir
try {
  & $npm.Source install --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  & $node.Source -e "require('node-pty'); require('ws')"
  if ($LASTEXITCODE -ne 0) {
    Write-Warning 'node-pty native build may have been blocked by npm.'
    $approval = Read-Host 'Approve node-pty install script now? [Y/N]'
    if ($approval -notmatch '^[Yy]$') {
      throw 'Native dependency approval declined'
    }
    & $npm.Source install-scripts approve node-pty
    if ($LASTEXITCODE -ne 0) {
      throw 'npm install-scripts approval failed'
    }
    & $npm.Source rebuild node-pty --foreground-scripts
    if ($LASTEXITCODE -ne 0) { throw 'node-pty rebuild failed' }
    & $node.Source -e "require('node-pty'); require('ws')"
    if ($LASTEXITCODE -ne 0) {
      throw 'node-pty remains unavailable'
    }
  }
  Write-Host 'Starting the Local Agent without keeping CMD open...'
  & (Join-Path $agentDir 'Background-Agent.ps1') -Action Start -Origin $origin
  if (-not $?) { throw 'Background Local Agent failed' }
  Write-Host 'You can close this setup window; Local Agent remains running.'
  # Present the freshly protected pairing token in this interactive
  # Quick-Setup CMD only. Never copy it into a log or a download URL.
  Write-Host 'Local Agent pairing Token for the trusted connection form:'
  & (Join-Path $agentDir 'Background-Agent.ps1') -Action Token
  if (-not $?) { throw 'Unable to show Local Agent pairing Token' }
  Write-Host 'Keep this Token private; only enter it in your local pairing form.'
  Write-Host 'To stop: run Background-Agent.ps1 -Action Stop.'
} finally {
  Pop-Location
}
