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
  foreach ($name in @('server.cjs','package.json','Port-CPO.ps1')) {
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
Write-Host 'AI AGENT MCP(ChatGPT) - local setup'
Write-Host ('Source: ' + $SourceRevision)
$node = Ensure-Node
Ensure-Files
. (Join-Path $agentDir 'Port-CPO.ps1')
$port = Select-ServicePort 'terminal'
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
  $env:CLUSTER_TERMINAL_ORIGIN = $origin
  $env:CLUSTER_TERMINAL_PORT = [string]$port
  Write-Host ('Agent port: ' + $port)
  Write-Host 'Copy this port and the pairing token into ClusterOpt2.'
  Write-Host 'Keep the CMD window open while using AI Agent.'
  & $node.Source (Join-Path $agentDir 'server.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Agent terminated unexpectedly' }
} finally {
  Pop-Location
}
