@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterOpt2 - ChatGPT MCP Quick Setup
set "REV=079110435ef499f87774c064da4bd6eff750af77"
set "ROOT=%LOCALAPPDATA%\ClusterOpt2\AI-Agent-MCP"
set "BASE=https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/%REV%/Implementation/plugins/ai-agent-mcp/local-agent"
echo ====================================================
echo ClusterOpt2 ChatGPT MCP - Quick Setup
echo ====================================================
echo Download source: https://github.com/xcxc84584-prog/ClusterOpt2
echo This setup downloads reviewed scripts and starts loopback services.
echo It does NOT publish a public HTTPS endpoint or grant file access.
echo Start and pair the Local Agent in ClusterOpt2 first.
echo.
choice /M "Continue"
if errorlevel 2 exit /b 0
if errorlevel 1 goto confirmed
goto failed

:confirmed
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 20+ is required. Run AI Agent Quick-Setup first.
  goto failed
)
node.exe -e "process.exit(parseInt(process.versions.node,10)>=20?0:1)"
if errorlevel 1 (
  echo Update Node.js to version 20 or later.
  goto failed
)
if not exist "%ROOT%" (
  mkdir "%ROOT%"
  if errorlevel 1 goto failed
)
echo [1/3] Downloading pinned MCP and OAuth files...
for %%F in (remote-mcp.cjs oauth-mcp-gateway.cjs Start-MCP.ps1 Start-OAuth.ps1 Port-CPO.ps1) do (
  powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $url=$env:BASE+'/%%F'; $target=Join-Path $env:ROOT '%%F'; $temp=$target+'.download'; try { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $temp -TimeoutSec 45; if((Get-Item -LiteralPath $temp).Length -lt 100){throw 'Incomplete download'}; Move-Item -LiteralPath $temp -Destination $target -Force } finally { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }"
  if errorlevel 1 goto failed
)
echo [2/3] Starting local bearer-protected MCP on 127.0.0.1:43880...
echo If MCP port is occupied, the new window prompts C/P/O.
start "ClusterOpt2 MCP Gateway" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Start-MCP.ps1"
echo.
echo [3/3] Optional OAuth Gateway setup
echo Configure a trusted, stable HTTPS reverse proxy only to 127.0.0.1:43879.
echo Never expose ports 43881 or 43880 to the Internet.
choice /M "Start interactive OAuth configuration"
if errorlevel 2 goto finish
if errorlevel 1 goto oauth
goto failed

:oauth
echo If OAuth port is occupied, the new window prompts C/P/O.
start "ClusterOpt2 OAuth Gateway" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -Command "$issuer=Read-Host 'Trusted public HTTPS issuer (origin only)'; if($issuer -notmatch '^https://[^/?#]+$'){throw 'Invalid issuer origin'}; & (Join-Path $env:ROOT 'Start-OAuth.ps1') -Issuer $issuer"
echo In the new OAuth window enter an exact HTTPS origin.
echo Connect ChatGPT with the same origin plus /mcp.

:finish
echo.
echo MCP local setup initiated. Verify both spawned windows.
echo Connect ChatGPT to your HTTPS /mcp URL and approve OAuth.
echo Current OAuth scope cluster.read is READ ONLY.
echo Explorer changes and PowerShell require separate approved authorization.
pause
exit /b 0
:failed
echo [ERROR] MCP setup incomplete. Existing user processes were not stopped.
pause
exit /b 1
