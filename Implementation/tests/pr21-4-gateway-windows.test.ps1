# Real Windows acceptance for the existing MCP and OAuth gateway processes.
# No public tunnel is created; the issuer is local test metadata only.
$ErrorActionPreference='Stop'
$dir=Join-Path $PSScriptRoot '../plugins/ai-agent-mcp/local-agent'
$manager=Join-Path $dir 'Background-Gateway.ps1'
$root=Join-Path $env:LOCALAPPDATA 'ClusterOpt2\AI-Agent-MCP'
# The production installer places the existing gateway files here.
# Replicate that layout without downloading or publishing any service.
New-Item -ItemType Directory -Path $root -Force|Out-Null
foreach($name in @('remote-mcp.cjs','oauth-mcp-gateway.cjs',
                   'secure-store.cjs')){
 Copy-Item -LiteralPath (Join-Path $dir $name) -Destination (
   Join-Path $root $name) -Force
}
$original=$null
$mcpRunning=$false
$oauthRunning=$false
function Check($value,$reason){if(-not $value){throw $reason}}
try{
 Check (-not (Test-Path (Join-Path $root 'gateway-mcp.json'))) 'MCP preexisting in CI'
 Check (-not (Test-Path (Join-Path $root 'gateway-oauth.json'))) 'OAuth preexisting in CI'
 & $manager -Action StartMCP | Out-Null
 $mcpRunning=$true
 $mcp=Get-Content (Join-Path $root 'gateway-mcp.json') -Raw|ConvertFrom-Json
 Check ([int]$mcp.pid -gt 4) 'MCP PID missing'
 Check (@(Get-NetTCPConnection -LocalPort ([int]$mcp.port) -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq [int]$mcp.pid}).Count -gt 0) 'MCP not listening'
 & $manager -Action StartOAuth -Issuer 'https://clusteropt2.example.test'|Out-Null
 $oauthRunning=$true
 $oauthFile=Join-Path $root 'gateway-oauth.json'
 $oauth=Get-Content $oauthFile -Raw|ConvertFrom-Json
 $metadata=Invoke-RestMethod ('http://127.0.0.1:'+$oauth.port+'/.well-known/oauth-authorization-server') -TimeoutSec 4
 Check ($metadata.issuer -eq 'https://clusteropt2.example.test') 'OAuth metadata incorrect'
 Check (@(Get-NetTCPConnection -LocalPort ([int]$oauth.port) -State Listen -ErrorAction SilentlyContinue|Where-Object {$_.OwningProcess -eq [int]$oauth.pid}).Count -gt 0) 'OAuth not listening'
 $original=Get-Content $oauthFile -Raw
 $tampered=$original|ConvertFrom-Json
 $tampered.pid=$PID
 $tampered|ConvertTo-Json|Set-Content -LiteralPath $oauthFile -Encoding UTF8
 $denied=$false
 try{& $manager -Action StopOAuth *> $null}catch{$denied=$true}
 Check $denied 'A tampered OAuth PID was accepted'
 Check ([bool](Get-Process -Id ([int]$oauth.pid) -ErrorAction SilentlyContinue)) 'Tampering killed the original service'
 Set-Content -LiteralPath $oauthFile -Value $original -Encoding UTF8
 $original=$null
 & $manager -Action StopOAuth|Out-Null
 $oauthRunning=$false
 & $manager -Action StopMCP|Out-Null
 $mcpRunning=$false
 Check (-not (Test-Path $oauthFile)) 'OAuth state survived StopOAuth'
 Check (-not (Test-Path (Join-Path $root 'gateway-mcp.json'))) 'MCP state survived StopMCP'
 Write-Host 'PR21.4 legacy gateway background lifecycle PASS'
} finally {
 if($original){Set-Content -LiteralPath (Join-Path $root 'gateway-oauth.json') -Value $original -Encoding UTF8}
 if($oauthRunning){try{& $manager -Action StopOAuth *> $null}catch{}}
 if($mcpRunning){try{& $manager -Action StopMCP *> $null}catch{}}
}
