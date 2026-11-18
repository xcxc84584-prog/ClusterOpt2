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
foreach($file in $assets){
 $target=Join-Path $root $file
 $partial=$target+'.download'
 try{
  Invoke-WebRequest -UseBasicParsing -Uri ($base+$file) -OutFile $partial -TimeoutSec 45 -ErrorAction Stop
  if((Get-Item -LiteralPath $partial).Length -lt 80){throw ('Incomplete asset: '+$file)}
  Move-Item -LiteralPath $partial -Destination $target -Force
  Write-Host ('Verified: '+$file)
 }finally{
  Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
 }
}
$manager=Join-Path $root 'Background-Gateway.ps1'
Write-Host 'Launching the existing Cluster local MCP in the background...'
& $manager -Action StartMCP
if(-not $?){throw 'MCP background start failed'}
Write-Host 'MCP ready. No persistent CMD or PowerShell window is required.'
Write-Host 'ChatGPT OAuth uses the original Cloudflare quick-tunnel process.'
$consent=Read-Host 'Start the optional OAuth/HTTPS connection now? [Y/N]'
if($consent -match '^[Yy]$'){
 & $manager -Action StartOAuth
 if(-not $?){throw 'OAuth background start failed'}
 # Display only in the interactive setup console, never in a log.
 $approvalFile=Join-Path $env:LOCALAPPDATA (
  'ClusterTerminalAgent\oauth-approval-password')
 if(Test-Path -LiteralPath $approvalFile -PathType Leaf){
  $approvalPassword=(Get-Content -LiteralPath $approvalFile -Raw).Trim()
  if($approvalPassword){
   Write-Host ''
   Write-Host '===================================================='
   Write-Host 'ChatGPT OAuth local approval password:'
   Write-Host $approvalPassword
   Write-Host 'Keep this password private; enter it only on your OAuth approval page.'
   Write-Host '===================================================='
  }else{
   Write-Warning 'OAuth approval password file is empty.'
  }
 }else{
  Write-Warning 'OAuth approval password not found; check gateway initialization.'
 }
}
& $manager -Action Status
Write-Host 'To check/stop, run Background-Gateway.ps1 -Action Status/StopOAuth/StopMCP.'
