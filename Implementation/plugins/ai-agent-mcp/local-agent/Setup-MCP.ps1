# Standalone installer derived from the working Cluster MCP OneClick flow.
# Download reviewed versions of the original Node gateway files, then start
# a hidden user-scoped service. Browser permissions remain separately gated.
param([ValidatePattern('^[a-f0-9]{40}$')][string]$SourceRevision)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'ClusterOpt2\AI-Agent-MCP'
$base='https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/'+$SourceRevision+'/Implementation/plugins/ai-agent-mcp/local-agent/'
$assets=@('remote-mcp.cjs','oauth-mcp-gateway.cjs',
 'secure-store.cjs','Port-CPO.ps1','Background-Gateway.ps1',
 'Start-MCP.ps1','Start-OAuth.ps1')
$node=Get-Command node.exe -ErrorAction Stop
$version=& $node.Source -p 'parseInt(process.versions.node,10)'
if($LASTEXITCODE -ne 0 -or [int]$version -lt 20){throw 'Node.js >=20 is required'}
New-Item -ItemType Directory -Path $root -Force|Out-Null
Write-Host 'Downloading pinned Cluster legacy MCP/OAuth gateways...'
# A temporary GitHub/CDN 503 must not invalidate a previous good file.
# Download into a temporary path and atomically replace only on success.
foreach($file in $assets){
 $target=Join-Path $root $file
 $partial=$target+'.download'
 $complete=$false
 try{
  for($attempt=1;$attempt -le 5;$attempt++){
   try{
    Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
    Invoke-WebRequest -UseBasicParsing -Uri ($base+$file) `
      -OutFile $partial -TimeoutSec 45 -ErrorAction Stop
    if(!(Test-Path -LiteralPath $partial) -or
       (Get-Item -LiteralPath $partial).Length -lt 80){
     throw ('Incomplete asset: '+$file)
    }
    Move-Item -LiteralPath $partial -Destination $target -Force
    Write-Host ('Verified: '+$file)
    $complete=$true
    break
   }catch{
    if($attempt -eq 5){
     throw ('Could not download '+$file+' after 5 attempts: '+
       $_.Exception.Message)
    }
    $delay=[int][Math]::Min(30,[Math]::Pow(2,$attempt))
    Write-Warning ('Download '+$file+' failed (attempt '+$attempt+
      '/5). Retrying after '+$delay+'s: '+$_.Exception.Message)
    Start-Sleep -Seconds $delay
   }
  }
 }finally{
  Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
 }
 if(!$complete){throw ('Download incomplete: '+$file)}
}
# Review saved local state before launching another gateway or tunnel.
# Quick Tunnel hostnames are temporary; the old URL must be probed.
$manager=Join-Path $root 'Background-Gateway.ps1'
$existing=@('gateway-mcp.json','gateway-oauth.json','gateway-tunnel.json') |
 Where-Object { Test-Path -LiteralPath (Join-Path $root $_) }
$decision='N'
if(@($existing).Count -gt 0){
 Write-Host ''
 Write-Warning 'Previous local MCP/OAuth connection records were found.'
 & $manager -Action Status
 $savedOAuth=Join-Path $root 'gateway-oauth.json'
 if(Test-Path -LiteralPath $savedOAuth){
  try {
   $previous=Get-Content -LiteralPath $savedOAuth -Raw | ConvertFrom-Json
   if($previous.issuer){Write-Host ('Previous URL: '+$previous.issuer+'/mcp')}
  }catch{Write-Warning 'Previous OAuth record is unreadable.'}
 }
 Write-Host '[R] Reuse existing services and verify the public MCP URL.'
 Write-Host '[D] Revoke local OAuth/tunnel records and create a fresh URL.'
 Write-Host '[C] Cancel without changing running services.'
 do { $decision=(Read-Host 'Choose R/D/C').Trim().ToUpperInvariant() }
 while($decision -notin @('R','D','C'))
 if($decision -eq 'C'){Write-Host 'Setup cancelled; existing services kept.';exit 0}
 if($decision -eq 'D'){
  Write-Warning 'A fresh trycloudflare URL requires updating the ChatGPT connector.'
  Write-Host 'Local revocation does not delete the existing ChatGPT app connection.'
  if((Read-Host 'Confirm local OAuth/tunnel revocation? Type REVOKE') -cne 'REVOKE'){
   Write-Host 'No changes made to existing services.';exit 0
  }
  & $manager -Action StopOAuth
  if(-not $?){throw 'Unable to revoke existing local OAuth/tunnel records'}
  # The old Node process keeps its pre-update module in memory.
  # D is an explicit restart consent; refresh the verified MCP process.
  if(Test-Path -LiteralPath (Join-Path $root 'gateway-mcp.json')){
   & $manager -Action StopMCP
   if(-not $?){throw 'Unable to restart the previous verified MCP'}
   Write-Host 'Previous verified MCP stopped for code update.'
  }
 }
}
. (Join-Path $root 'Port-CPO.ps1')
Write-Host 'Launching the existing Cluster local MCP in the background...'
& $manager -Action StartMCP
if(-not $?){throw 'MCP background start failed'}
Write-Host 'MCP ready. No persistent CMD or PowerShell window is required.'
Write-Host 'ChatGPT OAuth uses the original Cloudflare quick-tunnel process.'
if($decision -eq 'R'){
 & $manager -Action StartOAuth
 if(-not $?){throw 'Saved OAuth URL failed validation; rerun and choose D'}
 $consent='N'
}else{
 $consent=Read-Host 'Start the optional OAuth/HTTPS connection now? [Y/N]'
}
if($consent -match '^[Yy]$'){
 & $manager -Action StartOAuth
 if(-not $?){throw 'OAuth background start failed'}

}
& $manager -Action Status
# Single final connection summary; credentials never enter saved log files.
$mcpRecord = Join-Path $root 'gateway-mcp.json'
$oauthRecord = Join-Path $root 'gateway-oauth.json'
$tokenPath = Join-Path $env:LOCALAPPDATA 'ClusterTerminalAgent\remote-mcp-token'
if ((Test-Path $mcpRecord) -and (Test-Path $tokenPath)) {
 $mcpState = Get-Content $mcpRecord -Raw | ConvertFrom-Json
 $mcpToken = (Get-Content $tokenPath -Raw).Trim()
 Write-Host ('PORT MASSAGE : MCP ' + $mcpState.port + ' : ' +
  $mcpToken + ' (http://127.0.0.1:' + $mcpState.port + '/mcp)')
}
if (Test-Path $oauthRecord) {
 $oauthState = Get-Content $oauthRecord -Raw | ConvertFrom-Json
 $approvalPath = Join-Path $env:LOCALAPPDATA 'ClusterTerminalAgent\oauth-approval-password'
 if (Test-Path $approvalPath) {
  $approval = (Get-Content $approvalPath -Raw).Trim()
  Write-Host ('PORT MASSAGE : OAUTH ' + $oauthState.port + ' : ' +
   $approval + ' (' + $oauthState.issuer + '/mcp)')
 }
}
