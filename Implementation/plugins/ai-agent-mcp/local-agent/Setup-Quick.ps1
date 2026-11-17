# Plugin-local one-click setup, designed for an extracted ZIP.
# No automatic elevation, network listener exposure or token upload.
$ErrorActionPreference = 'Stop'
$agentDir = $PSScriptRoot
$expectedOrigin = 'https://xcxc84584-prog.github.io'

function Find-Node20 {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { return $null }
  $version = & $node.Source -p "process.versions.node"
  if ($LASTEXITCODE -ne 0) { return $null }
  $major = [int]($version.Split('.')[0])
  if ($major -lt 20) { return $null }
  return $node
}

if (-not (Test-Path -LiteralPath (Join-Path $agentDir 'server.cjs'))) {
  throw 'Missing server.cjs: extract the full plugin ZIP first.'
}
$node = Find-Node20
if (-not $node) {
  Write-Host 'Node.js 20+ is required.' -ForegroundColor Yellow
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $winget) {
    throw 'Install Node.js LTS and reopen this installer.'
  }
  $consent = Read-Host 'Install Node.js LTS using winget? [Y/N]'
  if ($consent -notmatch '^[Yy]$') {
    throw 'Node.js installation was declined.'
  }
  & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw 'Node.js install failed.' }
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') +
    ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $node = Find-Node20
  if (-not $node) {
    throw 'Node.js is not available. Reopen CMD and run Quick-Setup.cmd.'
  }
}
$npm = Get-Command npm.cmd -ErrorAction Stop
Write-Host 'Installing local Agent dependencies in plugin folder...'
Push-Location $agentDir
try {
  & $npm.Source install --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
  $env:CLUSTER_TERMINAL_ORIGIN = $expectedOrigin
  Write-Host 'Local agent port: 43879 (127.0.0.1 only)'
  Write-Host 'Copy the pairing token printed by the Agent into ClusterOpt2.'
  Write-Host 'Keep this window open to keep the Agent running.'
  & $node.Source (Join-Path $agentDir 'server.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Agent exited unexpectedly.' }
} finally {
  Pop-Location
}
