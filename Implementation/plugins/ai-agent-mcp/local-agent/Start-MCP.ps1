# MCP loopback listener with shared C/P/O port selection.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Port-CPO.ps1')
$ports = Get-ServicePorts
Show-PortInventory -Phase 'BEFORE MCP START' -PairService 'terminal'
$selected = Select-ServicePort 'mcp'
$env:CLUSTER_MCP_PORT = [string]$selected
$env:CLUSTER_TERMINAL_PORT = [string]$ports.terminal
$node = Get-Command node.exe -ErrorAction Stop
Write-Host ("MCP port: {0}; Local Agent: {1}" -f $selected,$ports.terminal)
Write-Host 'Service is starting in foreground; listener status follows.'
& $node.Source (Join-Path $PSScriptRoot 'remote-mcp.cjs')
if ($LASTEXITCODE -ne 0) { throw 'MCP gateway failed' }
