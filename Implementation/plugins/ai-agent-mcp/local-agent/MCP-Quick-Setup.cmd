@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterOpt2 ChatGPT MCP - Legacy OneClick Background -r1
set "REV=1a83db9f8979b701b68a924c09366f6ceef92417"
set "ROOT=%LOCALAPPDATA%\ClusterOpt2\AI-Agent-MCP"
set "SCRIPT=%ROOT%\Setup-MCP.ps1"
echo ====================================================
echo ClusterOpt2 - MCP OneClick Background -r1
echo ====================================================
echo Uses legacy Cluster Node MCP and OAuth + cloudflared.
echo Runs locally; the optional tunnel exposes OAuth only.
echo Start-MCP.ps1 and Start-OAuth.ps1 remain compatible.
choice /M "Continue"
if errorlevel 2 exit /b 0
if not exist "%ROOT%" (
  mkdir "%ROOT%"
  if errorlevel 1 goto failed
)
echo [1/2] Downloading pinned Setup-MCP.ps1...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; try { $url='https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/%REV%/Implementation/plugins/ai-agent-mcp/local-agent/Setup-MCP.ps1'; $tmp='%SCRIPT%.download'; Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp -TimeoutSec 45; if((Get-Item -LiteralPath $tmp).Length -lt 500){throw 'Incomplete download'}; Move-Item -LiteralPath $tmp -Destination '%SCRIPT%' -Force; exit 0 } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }"
if errorlevel 1 goto failed
echo [2/2] Starting background Cluster gateways...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -SourceRevision "%REV%"
if errorlevel 1 goto failed
echo [OK] Setup completed. You may close this window.
echo Press any key to exit this setup window.
pause >nul
exit /b 0
:failed
echo [ERROR] Setup stopped. Check the error above and retry.
pause
exit /b 1
