// v0.0.64 r2: resilient bootstrap with multiple HTTPS sources and retries.
export const PLA_SOURCE='https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt/main/Program/local-agent/server.mjs';
export const SETUP_FILENAME='ClusterOpt-PLA-Setup-v0.0.64-r2.cmd';
export function createSetupCmd(){
 const lines=[
 '@echo off',
 'setlocal EnableExtensions DisableDelayedExpansion',
 'title ClusterOpt Local Agent v0.0.64 r2',
 'echo ==========================================',
 'echo ClusterOpt PowerShell Local Agent v0.0.64 r2',
 'echo ==========================================',
 'set "AGENT_DIR=%USERPROFILE%\\ClusterOpt-Agent"',
 'if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"',
 'if errorlevel 1 goto failed',
 'set "INSTALLER=%AGENT_DIR%\\install-v064.ps1"',
 'echo [1/2] Downloading setup helper with fallback sources...',
 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'Stop\'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $path=Join-Path $env:USERPROFILE \'ClusterOpt-Agent\\install-v064.ps1\'; $sources=@(\'https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt/main/Program/local-agent/install-v064.ps1\',\'https://cdn.jsdelivr.net/gh/xcxc84584-prog/ClusterOpt@main/Program/local-agent/install-v064.ps1\',\'https://github.com/xcxc84584-prog/ClusterOpt/raw/refs/heads/main/Program/local-agent/install-v064.ps1\'); $ok=$false; foreach($url in $sources){for($i=1;$i -le 2;$i++){try{Write-Host (\'Trying \' + $url + \' (attempt \' + $i + \')\'); Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $path -TimeoutSec 35; if((Get-Item $path).Length -lt 1000){throw \'Incomplete installer\'}; $ok=$true;break}catch{Write-Warning $_.Exception.Message;Start-Sleep -Seconds 2}};if($ok){break}};if(-not $ok){Write-Host \'All installer mirrors failed. Check internet/proxy or retry later.\';exit 1}"',
 'if errorlevel 1 goto failed',
 'echo [2/2] Installing and starting agent...',
 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER%"',
 'if errorlevel 1 goto failed',
 'echo Setup complete. You can close this window.',
 'pause',
 'exit /b 0',
 ':failed',
 'echo [ERROR] Setup failed. Review the detailed error above.',
 'pause',
 'exit /b 1'
 ];
 return lines.join('\r\n')+'\r\n';
}
