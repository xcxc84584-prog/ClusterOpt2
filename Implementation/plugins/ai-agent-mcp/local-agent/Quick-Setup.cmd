@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterOpt2 AI AGENT MCP(ChatGPT) - Quick Setup
set "REV=15700573756c5c2236dcf1ff5cea6e314a698572"
set "ROOT=%LOCALAPPDATA%\ClusterOpt2\AI-Agent-MCP"
set "URI=https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/%REV%/Implementation/plugins/ai-agent-mcp/local-agent/Setup-Quick.ps1"
echo AI AGENT MCP(ChatGPT) - standalone setup
echo Source: https://github.com/xcxc84584-prog/ClusterOpt2
echo This CMD downloads a pinned setup helper and approved plugin sources.
echo It installs local dependencies; it does NOT request admin access.
echo If port 43881 is used, choose P / C / O.
choice /M "Continue"
if errorlevel 2 exit /b 0
if errorlevel 1 goto confirmed
goto failed
:confirmed
if not exist "%ROOT%" (
  mkdir "%ROOT%"
  if errorlevel 1 goto failed
)
echo [1/2] Downloading verified-revision setup helper...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Invoke-WebRequest -UseBasicParsing -Uri '%URI%' -OutFile '%ROOT%\Setup-Quick.ps1' -TimeoutSec 45; if((Get-Item -LiteralPath '%ROOT%\Setup-Quick.ps1').Length -lt 1000){throw 'Incomplete setup helper'}"
if errorlevel 1 goto failed
echo [2/2] Starting guided setup...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Setup-Quick.ps1" -SourceRevision "%REV%"
if errorlevel 1 goto failed
echo Setup complete.
pause
exit /b 0
:failed
echo [ERROR] Setup cancelled or failed. Existing service was not automatically stopped.
pause
exit /b 1
