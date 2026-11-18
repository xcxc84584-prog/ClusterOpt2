# Thin background supervisor for the existing Cluster Node MCP and OAuth gateways.
# Revision: -r1 (cloudflared executable path output isolation).
param(
 [ValidateSet('StartMCP','StartOAuth','StopMCP','StopOAuth','Status')]
 [string]$Action='Status',
 [ValidatePattern('^$|^https://[^/?#]+$')] [string]$Issuer=''
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Port-CPO.ps1')
$root=Join-Path $env:LOCALAPPDATA 'ClusterOpt2\AI-Agent-MCP'
$logs=Join-Path $root 'logs'
function RecordPath($name){ Join-Path $root ('gateway-'+$name+'.json') }
function ReadRecord($name){
 $p=RecordPath $name
 if(Test-Path -LiteralPath $p){Get-Content -LiteralPath $p -Raw|ConvertFrom-Json}
}
function SaveRecord($name,$value){
 New-Item -ItemType Directory -Path $root -Force|Out-Null
 $p=RecordPath $name;$tmp=$p+'.new'
 $value|ConvertTo-Json -Depth 4|Set-Content -LiteralPath $tmp -Encoding UTF8
 Move-Item -LiteralPath $tmp -Destination $p -Force
}
function Inspect($procId){
 if($procId -le 4 -or $procId -eq $PID){return $null}
 Get-CimInstance Win32_Process -Filter ('ProcessId='+$procId) -ErrorAction SilentlyContinue
}
function Owned($record,$service){
 if(!$record -or !$record.pid -or !$record.exe -or !$record.started -or !$record.signature){return $false}
 $p=Inspect ([int]$record.pid)
 if(!$p -or !$p.CreationDate -or !$p.ExecutablePath -or !$p.CommandLine){return $false}
 if($p.ExecutablePath -ine $record.exe -or
    $p.CreationDate.ToUniversalTime().ToString('o') -cne $record.started -or
    $p.CommandLine.IndexOf([string]$record.signature,[StringComparison]::OrdinalIgnoreCase) -lt 0){return $false}
 if($service -eq 'tunnel'){return ($p.CommandLine -match '(?i)\btunnel\b')}
 if(!$record.port -or [int]$record.port -lt 1024 -or [int]$record.port -gt 65535){return $false}
 return (@(Listeners ([int]$record.port)|Where-Object {$_.OwningProcess -eq [int]$record.pid}).Count -gt 0)
}
function Snapshot($child,$signature,$port){
 $p=Inspect ([int]$child.Id)
 if(!$p -or !$p.ExecutablePath -or !$p.CreationDate -or !$p.CommandLine -or
    $p.CommandLine.IndexOf($signature,[StringComparison]::OrdinalIgnoreCase) -lt 0){
  throw 'Could not identify spawned background process'
 }
 return @{pid=[int]$child.Id;exe=[string]$p.ExecutablePath;
   started=$p.CreationDate.ToUniversalTime().ToString('o');signature=$signature;port=$port}
}
function StopOwned($service){
 $record=ReadRecord $service
 if(!(Owned $record $service)){throw ('Unverified '+$service+' process; refusing stop')}
 if(!(Owned $record $service)){throw 'Process identity changed'}
 Stop-Process -Id ([int]$record.pid) -Force -ErrorAction Stop
 Remove-Item -LiteralPath (RecordPath $service) -Force
}
function NodeExe {
 $n=Get-Command node.exe -ErrorAction Stop
 $major=& $n.Source -p 'parseInt(process.versions.node,10)'
 if($LASTEXITCODE -ne 0 -or [int]$major -lt 20){throw 'Node >=20 required'}
 return $n.Source
}
function StartNode($service,$file,$port){
 $scriptFile=Join-Path $root $file
 if(!(Test-Path -LiteralPath $scriptFile)){throw ('Missing '+$file)}
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $arg='"'+$scriptFile+'"'
 $child=Start-Process -FilePath (NodeExe) -ArgumentList $arg -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs ($service+'.out')) -RedirectStandardError (Join-Path $logs ($service+'.err'))
 try{
  $ready=$false
  for($i=0;$i -lt 50;$i++){
   Start-Sleep -Milliseconds 250
   if(@(Listeners $port|Where-Object {$_.OwningProcess -eq $child.Id}).Count -gt 0){$ready=$true;break}
   if($child.HasExited){break}
  }
  if(!$ready){throw ($service+' could not bind local port')}
  return (Snapshot $child ([IO.Path]::GetFullPath($scriptFile)) $port)
 }catch{
  if(!$child.HasExited){Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue}
  throw
 }
}
function CloudflaredExe {
 $found=Get-Command cloudflared.exe -ErrorAction SilentlyContinue
 if($found){return $found.Source}
 $paths=@(
  (Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'cloudflared\cloudflared.exe'),
  (Join-Path $env:ProgramFiles 'cloudflared\cloudflared.exe'),
  (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\cloudflared.exe'))
 foreach($p in $paths){if(Test-Path -LiteralPath $p){return $p}}
 $winget=Get-Command winget.exe -ErrorAction SilentlyContinue
 if(!$winget){throw 'Install cloudflared before OAuth setup'}
 if((Read-Host 'Install cloudflared via winget? [Y/N]') -notmatch '^[Yy]$'){throw 'Cancelled'}
 # -r1: winget writes installation messages to the success stream.
 # Send them to the interactive console instead of returning them as paths.
 & $winget.Source install --id Cloudflare.cloudflared --exact --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Host
 if($LASTEXITCODE -ne 0){throw 'cloudflared install failed'}
 $found=Get-Command cloudflared.exe -ErrorAction SilentlyContinue
 if($found){return $found.Source}
 foreach($p in $paths){if(Test-Path -LiteralPath $p){return $p}}
 throw 'Reopen installer to discover cloudflared'
}
function Tunnel($port){
 New-Item -ItemType Directory -Path $logs -Force|Out-Null
 $target='http://127.0.0.1:'+$port
 $out=Join-Path $logs 'tunnel.out'
 $err=Join-Path $logs 'tunnel.err'
 $child=Start-Process -FilePath (CloudflaredExe) -ArgumentList @('tunnel','--url',$target,'--no-autoupdate') -WindowStyle Hidden -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
 try{
  $url=''
  for($i=0;$i -lt 90;$i++){
   Start-Sleep -Milliseconds 500
   if($child.HasExited){throw 'cloudflared exited'}
   foreach($file in @($err,$out)){
    if(Test-Path -LiteralPath $file){
     $raw=Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue
     if($raw -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'){$url=$Matches[0];break}
    }
   }
   if($url){break}
  }
  if(!$url){throw 'Timed out waiting for HTTPS URL'}
  return @{issuer=$url;process=(Snapshot $child $target 0)}
 }catch{
  if(!$child.HasExited){Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue}
  throw
 }
}
# A listening local OAuth gateway is not proof ChatGPT can reach its URL.
# Check its public metadata and the expected unauthenticated MCP challenge.
function Confirm-PublicMcp([string]$origin){
 $lastError='No response'
 for($attempt=1;$attempt -le 5;$attempt++){
  try{
   $oauth=Invoke-RestMethod -Uri ($origin+
     '/.well-known/oauth-authorization-server') -TimeoutSec 10
   $resource=Invoke-RestMethod -Uri ($origin+
     '/.well-known/oauth-protected-resource/mcp') -TimeoutSec 10
   if($oauth.issuer -cne $origin -or
      $resource.resource -cne ($origin+'/mcp') -or
      @($resource.authorization_servers) -cnotcontains $origin){
    throw 'Public OAuth discovery metadata does not match tunnel issuer'
   }
   $status=0
   try{
    $response=Invoke-WebRequest -UseBasicParsing -Uri ($origin+'/mcp') `
      -TimeoutSec 10 -ErrorAction Stop
    $status=[int]$response.StatusCode
   }catch{
    if($_.Exception.Response){
     $status=[int]$_.Exception.Response.StatusCode
    }else{throw}
   }
   if($status -ne 401){
    throw ('Public /mcp should require OAuth (401); got HTTP '+$status)
   }
   return
  }catch{
   $lastError=$_.Exception.Message
   if($attempt -lt 5){Start-Sleep -Seconds ([int]$attempt*2)}
  }
 }
 throw ('Public MCP URL failed HTTPS/OAuth preflight: '+$lastError+
   '. Check Cloudflare tunnel and retry with a fresh URL.')
}
Show-PortInventory -Phase 'BEFORE ACTION' -PairService 'terminal'
switch($Action){
 'Status' {
  foreach($service in @('mcp','oauth')){
   $saved=ReadRecord $service
   Write-Host ($service+': '+$(if(Owned $saved $service){'running'}else{'not running'}))
   if($service -eq 'oauth' -and (Owned $saved $service)){
    Write-Host ('ChatGPT MCP URL: '+$saved.issuer+'/mcp')
   }
  }
 }
 'StopOAuth' {
  # Called only after explicit local revocation confirmation.
  # Never kill a PID which cannot be identity verified.
  foreach($service in @('oauth','tunnel')){
   $record=ReadRecord $service
   if(!$record){continue}
   if(Owned $record $service){
    StopOwned $service
   }else{
    $process=if($record.pid){Inspect ([int]$record.pid)}else{$null}
    if($process -and !$process.HasExited){
     throw ('Unverified '+$service+
       ' process still exists. Refusing to discard ownership record.')
    }
    Remove-Item -LiteralPath (RecordPath $service) -Force
    Write-Host ('Removed expired '+$service+' record')
   }
  }
  Show-PortInventory -Phase 'AFTER OAUTH STOP' -PairService 'terminal'
  Write-Host 'Local OAuth/tunnel registration stopped'
 }
 'StopMCP' {
  if(Owned (ReadRecord 'oauth') 'oauth'){throw 'Stop OAuth first'}
  StopOwned 'mcp'
  Show-PortInventory -Phase 'AFTER MCP STOP' -PairService 'terminal'
  Write-Host 'MCP stopped'
 }
 'StartMCP' {
  if(Owned (ReadRecord 'mcp') 'mcp'){Write-Host 'MCP already running';break}
  $ports=Get-ServicePorts
  $port=Select-ServicePort 'mcp'
  $env:CLUSTER_MCP_PORT=[string]$port
  $env:CLUSTER_TERMINAL_PORT=[string]$ports.terminal
  SaveRecord 'mcp' (StartNode 'mcp' 'remote-mcp.cjs' $port)
  Write-Host ('Background MCP ready on 127.0.0.1:'+$port)
 }
 'StartOAuth' {
  $mcp=ReadRecord 'mcp'
  if(!(Owned $mcp 'mcp')){throw 'Start MCP first'}
  $old=ReadRecord 'oauth'
  if(Owned $old 'oauth'){
   try {
    Confirm-PublicMcp ([string]$old.issuer)
    Write-Host ('Verified existing ChatGPT MCP URL: '+$old.issuer+'/mcp')
    break
   } catch {
    throw ('Existing OAuth process is running but its URL is not valid. '+
     'Use Setup-MCP to explicitly revoke and recreate the local tunnel. '+
     $_.Exception.Message)
   }
  }
  if($old -or (ReadRecord 'tunnel')){
   throw 'Existing OAuth/tunnel records require review. Run Setup-MCP to reuse or revoke.'
  }
  $port=Select-ServicePort 'oauth'
  $env:CLUSTER_OAUTH_PORT=[string]$port
  $env:CLUSTER_MCP_PORT=[string]$mcp.port
  # Only the ephemeral Quick Tunnel path is recreated automatically.
  # A caller-specified fixed issuer is never replaced.
  $attemptLimit=if($Issuer){1}else{3}
  $verified=$false
  $failures=@()
  for($attempt=1;$attempt -le $attemptLimit;$attempt++){
   $tunnel=$null;$oauth=$null
   $candidate=$Issuer
   try {
    if(!$candidate){
     # Tunnel only forwards OAuth loopback. Do not expose MCP/Agent ports.
     $tunnel=Tunnel $port
     $candidate=[string]$tunnel.issuer
    }
    $env:CLUSTER_OAUTH_ISSUER=$candidate
    $oauth=StartNode 'oauth' 'oauth-mcp-gateway.cjs' $port
    $meta=Invoke-RestMethod ('http://127.0.0.1:'+$port+
      '/.well-known/oauth-authorization-server') -TimeoutSec 4
    if($meta.issuer -cne $candidate){throw 'Local OAuth issuer mismatch'}
    # Do not publish an unresolvable hostname or unverified endpoint.
    # DNS may lag shortly after a new Cloudflare Quick Tunnel appears.
    $hostName=([uri]$candidate).DnsSafeHost
    $dnsOk=$false
    for($dnsAttempt=1;$dnsAttempt -le 6;$dnsAttempt++){
     try {
      $ips=[System.Net.Dns]::GetHostAddresses($hostName)
      if(@($ips).Count -gt 0){$dnsOk=$true;break}
     } catch {
      if($dnsAttempt -eq 6){throw ('DNS lookup failed for '+
        $hostName+': '+$_.Exception.Message)}
     }
     Start-Sleep -Seconds ([Math]::Min(5,$dnsAttempt))
    }
    if(!$dnsOk){throw ('DNS lookup returned no address for '+$hostName)}
    Confirm-PublicMcp $candidate
    $oauth.issuer=$candidate
    SaveRecord 'oauth' $oauth
    if($tunnel){SaveRecord 'tunnel' $tunnel.process}
    Show-PortInventory -Phase 'AFTER OAUTH START' -PairService 'terminal'
    Write-Host ('Verified ChatGPT MCP URL: '+$candidate+'/mcp')
    Write-Host 'OAuth continues running when this setup window is closed.'
    $verified=$true
    break
   } catch {
    $failures+=('attempt '+$attempt+': '+$_.Exception.Message)
    if($oauth -and (Owned $oauth 'oauth')){
     Stop-Process -Id $oauth.pid -Force -ErrorAction SilentlyContinue
    }
    if($tunnel -and (Owned $tunnel.process 'tunnel')){
     Stop-Process -Id $tunnel.process.pid -Force -ErrorAction SilentlyContinue
    }
    if($attempt -lt $attemptLimit){
     Write-Warning ('Quick Tunnel not publicly ready; generating a new URL ('+
       $attempt+'/'+$attemptLimit+').')
     Start-Sleep -Seconds 3
    }
   }
  }
  if(!$verified){
   throw ('Public MCP validation failed after '+$attemptLimit+
     ' attempt(s). Check local DNS, network, and Cloudflare routing. '+
     ($failures -join ' | '))
  }
 }
}
