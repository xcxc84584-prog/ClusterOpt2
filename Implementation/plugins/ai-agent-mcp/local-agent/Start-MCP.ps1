# PR14.8: loopback-only bearer-protected MCP.
$ErrorActionPreference = 'Stop'
$node = Get-Command node.exe -ErrorAction Stop
& $node.Source (Join-Path $PSScriptRoot 'remote-mcp.cjs')
if ($LASTEXITCODE -ne 0) { throw 'MCP gateway failed' }
