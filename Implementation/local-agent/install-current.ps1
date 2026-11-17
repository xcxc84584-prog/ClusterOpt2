param([Parameter(Mandatory=$true)][string]$ExpectedVersion)
if ($ExpectedVersion -notmatch '^0\.0\.\d+-pr\d+\.patch\d+(\.fix\d+)?$') { throw 'Invalid version' }
# ClusterOpt2 Local Agent - versioned installer with safe port ownership
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Join-Path $env:USERPROFILE 'ClusterOpt2-Agent'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$base = 'https://raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/main/Implementation/local-agent/'
function Download([string]$url,[string]$target) {
  $last = $null
  foreach ($candidate in @($url,($url -replace 'raw.githubusercontent.com/xcxc84584-prog/ClusterOpt2/main/','github.com/xcxc84584-prog/ClusterOpt2/raw/refs/heads/main/'))) {
    for ($i=0;$i -lt 3;$i++) {
      try { Invoke-WebRequest -UseBasicParsing -Uri $candidate -OutFile $target -TimeoutSec 45 -ErrorAction Stop; if((Get-Item $target).Length -lt 20){throw 'Downloaded file is empty'}; return }
      catch { $last = $_; Write-Warning ('Download retry: '+$_.Exception.Message); Start-Sleep -Seconds 2 }
    }
  }
  throw ('Download failed: '+$url+'; '+$last)
}
function FindNode {
  $c = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($c) {try {$v = & $c.Source --version; if ([int](($v -replace '^v','').Split('.')[0]) -ge 20) {return $c.Source}}catch{}}
  foreach($path in @((Join-Path $env:ProgramFiles 'nodejs\node.exe'),(Join-Path $dir 'node\node.exe'))) {
    if(Test-Path $path){return $path}
  }
  return $null
}
Write-Host '[1/5] Checking Node.js...'
$node = FindNode
if (-not $node) {
  Write-Host 'Installing portable Node.js LTS (no administrator rights required)...'
  $index = Invoke-RestMethod 'https://nodejs.org/dist/index.json' -TimeoutSec 45
  $release = $index | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
  if(-not $release){throw 'No Windows x64 Node.js LTS found'}
  $zip = Join-Path $dir 'node.zip'
  Download ('https://nodejs.org/dist/'+$release.version+'/node-'+$release.version+'-win-x64.zip') $zip
  Expand-Archive -Path $zip -DestinationPath (Join-Path $dir 'node-extract') -Force
  $extracted = Get-ChildItem (Join-Path $dir 'node-extract') -Directory | Select-Object -First 1
  if(-not $extracted){throw 'Node archive extraction failed'}
  Copy-Item $extracted.FullName (Join-Path $dir 'node') -Recurse -Force
  $node = Join-Path $dir 'node\node.exe'
}
$env:PATH = (Split-Path $node)+';'+$env:PATH
Write-Host '[2/5] Downloading agent files...'
foreach($file in @('server.mjs','native-terminal.mjs','package.json')) {Download ($base+$file) (Join-Path $dir $file)}
Write-Host '[3/5] Installing terminal dependencies...'
Push-Location $dir
try {
  & $node (Join-Path (Split-Path $node) 'node_modules\npm\bin\npm-cli.js') install --omit=dev --no-audit --no-fund
  if($LASTEXITCODE -ne 0){throw 'npm install failed; Windows build tools may be required for node-pty'}
} finally {Pop-Location}
$port = 43881
while($true) {
  Write-Host ('[4/5] Checking port '+$port)
  $listeners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
  if(-not $listeners){break}
  $ids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
  foreach($processId in $ids){$proc=Get-Process -Id $processId -ErrorAction SilentlyContinue;Write-Host ('Occupied: PID '+$processId+' '+$proc.ProcessName+' '+$proc.Path)}
  $choice = (Read-Host '[P]ick another port / [C]ancel').Trim().ToUpperInvariant()
  if($choice -eq 'C'){throw 'Cancelled by user'}
  if($choice -eq 'P'){
    $value=Read-Host 'Enter TCP port (1024-65535)'
    $number=0
    if(-not [int]::TryParse($value,[ref]$number) -or $number -lt 1024 -or $number -gt 65535){Write-Warning 'Invalid port';continue}
    $port=$number;continue
  }
  if($choice -ne 'P'){throw 'Cancelled to protect the existing listener'}
}
Write-Host '[5/5] Starting independent Local Agent...'
$out=Join-Path $dir 'agent-stdout.log';$err=Join-Path $dir 'agent-stderr.log'
if(Test-Path $out){Remove-Item $out -Force -ErrorAction SilentlyContinue}
if(Test-Path $err){Remove-Item $err -Force -ErrorAction SilentlyContinue}
$env:CLUSTEROPT_PORT = [string]$port
$env:CLUSTEROPT_AGENT_VERSION = $ExpectedVersion
Start-Process -FilePath $node -ArgumentList @('server.mjs') -WorkingDirectory $dir -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err | Out-Null
$ready=$false
for($i=0;$i -lt 100;$i++){
 Start-Sleep -Milliseconds 250
 if(Test-Path $out){
  $log=Get-Content $out -Raw -ErrorAction SilentlyContinue
  if($log -match 'Pairing token \(do not share\): ([a-f0-9]{64})'){
   Write-Host ('Agent port: '+$port)
   Write-Host ('PAIRING TOKEN (keep private): '+$Matches[1])
   $ready=$true;break
  }
 }
}
if(-not $ready){if(Test-Path $err){Get-Content $err -Tail 25};throw 'Agent startup timed out'}
Write-Host ('Agent version: '+$ExpectedVersion)
Write-Host 'Agent running. You may close this CMD window.'
