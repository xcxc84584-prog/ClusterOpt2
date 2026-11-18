@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ClusterOpt2 - ChatGPT MCP Quick Setup
set "SERVICE_NAME=clusteropt2"
set "REV=9e9055421f6b0d6c021297b28deedbee964b526a"
set "ROOT=%LOCALAPPDATA%\ClusterOpt2\AI-Agent-MCP"
set "BASE=https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/%REV%/Implementation/plugins/ai-agent-mcp/local-agent"
echo ====================================================
echo ClusterOpt2 ChatGPT MCP - Quick Setup
echo ====================================================
echo This downloads verified scripts to local app data.
echo It never opens a public HTTPS port or grants file access.
echo Pair the Local Agent before configuring MCP.
choice /M "Continue"
if errorlevel 2 exit /b 0
if errorlevel 1 goto confirmed
goto failed

:confirmed
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 20+ is required. Run Local Agent Quick-Setup first.
  goto failed
)
node.exe -e "process.exit(parseInt(process.versions.node,10)>=20?0:1)"
if errorlevel 1 (
  echo Node.js 20+ is required.
  goto failed
)
if not exist "%ROOT%" (
  mkdir "%ROOT%"
  if errorlevel 1 goto failed
)
echo [1/3] Downloading pinned MCP and OAuth files...
for %%F in (remote-mcp.cjs oauth-mcp-gateway.cjs Start-MCP.ps1 Start-OAuth.ps1 Port-CPO.ps1) do (
  call :download "%%F"
  if errorlevel 1 goto failed
)
echo All five gateway assets downloaded.
echo [2/3] Starting local bearer-protected MCP on 127.0.0.1:43880...
echo If MCP port is occupied, the new window prompts C/P/O.
start "ClusterOpt2 MCP Gateway" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\Start-MCP.ps1"
echo Wait until MCP completes any C/P/O port selection.
pause

echo [3/3] Optional OAuth Gateway setup
echo OAuth runs on 127.0.0.1:43879 by default.
echo You need a REAL public HTTPS hostname starting with clusteropt2.
echo Only forward the OAuth port; never expose 43881 or 43880.
choice /M "Start interactive OAuth configuration"
if errorlevel 2 goto finish
if errorlevel 1 goto oauth
goto failed

:oauth
start "ClusterOpt2 OAuth Gateway" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -Command "$issuer=Read-Host 'HTTPS origin (https://clusteropt2.YOUR-DOMAIN)'; try { $u=[uri]$issuer } catch { throw 'Invalid HTTPS URL' }; if($u.Scheme -ne 'https' -or $u.Host -notmatch '^clusteropt2\.' -or $u.AbsolutePath -ne '/' -or $u.Query -or $u.Fragment){throw 'Specify a real HTTPS hostname starting with clusteropt2.'}; & (Join-Path $env:ROOT 'Start-OAuth.ps1') -Issuer $issuer"
echo In the OAuth window enter the actual HTTPS origin.
echo Configure your HTTPS proxy to forward only to OAuth.
echo ChatGPT MCP endpoint is the same HTTPS origin plus /mcp.

:finish
echo Setup launched. Check the gateway windows for errors.
echo OAuth scope cluster.read is READ ONLY.
echo File writes and PowerShell still require local authorization.
pause
exit /b 0

:download
set "ASSET=%~1"
echo Fetching %ASSET%...
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $source=$env:BASE+'/'+$env:ASSET; $target=Join-Path $env:ROOT $env:ASSET; $temp=$target+'.download'; try { Invoke-WebRequest -UseBasicParsing -Uri $source -OutFile $temp -TimeoutSec 45; if((Get-Item -LiteralPath $temp).Length -lt 100){throw 'Incomplete download'}; Move-Item -LiteralPath $temp -Destination $target -Force; Write-Host ('Verified: '+$env:ASSET) } catch { [Console]::Error.WriteLine(('DOWNLOAD FAILED: '+$source+' : '+$_.Exception.Message)); exit 1 } finally { Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue }"
if errorlevel 1 (
  echo Failed asset: %ASSET%
  exit /b 1
)
exit /b 0

:failed
echo [ERROR] MCP setup incomplete. No user process was stopped.
pause
exit /b 1
