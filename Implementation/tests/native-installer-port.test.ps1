param()

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '..\local-agent\install-current.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $source, [ref]$tokens, [ref]$parseErrors
)
if ($parseErrors.Count -gt 0) { throw 'Installer has syntax errors' }

# Load only function declarations; never execute the real installer.
$functions = @($ast.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst]
}, $false))
foreach ($definition in $functions) {
    Invoke-Expression $definition.Extent.Text
}

$script:OwnerPid = 61234
$script:OwnerName = 'ordinary-test.exe'
$script:Stopped = $false
$script:StopCount = 0
$script:Replies = @()

function Get-NetTCPConnection {
    param($LocalPort, $State, $ErrorAction)
    if ($script:Stopped) { return }
    return [pscustomobject]@{ OwningProcess = $script:OwnerPid }
}

function Get-CimInstance {
    param($ClassName, $Filter, $ErrorAction)
    $id = [int]($Filter -replace '^ProcessId=', '')
    if ($id -eq $PID) {
        return [pscustomobject]@{
            ProcessId = $PID
            ParentProcessId = 0
        }
    }
    if ($id -eq $script:OwnerPid) {
        return [pscustomobject]@{
            ProcessId = $id
            ParentProcessId = 0
            Name = $script:OwnerName
            CreationDate = [datetime]'2026-11-17T00:00:00'
            ExecutablePath = 'test-process'
        }
    }
    return $null
}

function Read-Host {
    param($Prompt)
    if ($script:Replies.Count -eq 0) {
        throw 'Unexpected input request'
    }
    $value = $script:Replies[0]
    $script:Replies = @($script:Replies | Select-Object -Skip 1)
    return $value
}

function Stop-Process {
    param($Id, [switch]$Force, $ErrorAction)
    if ($Id -ne $script:OwnerPid) {
        throw 'Attempted to stop unexpected PID'
    }
    $script:StopCount++
    $script:Stopped = $true
}

function Start-Sleep {
    param($Milliseconds)
}

function Reset-Case {
    param([string[]]$Replies)
    $script:OwnerName = 'ordinary-test.exe'
    $script:Stopped = $false
    $script:StopCount = 0
    $script:Replies = $Replies
}

Reset-Case -Replies @('C')
try {
    Select-LoopbackPort | Out-Null
    throw 'C did not cancel'
} catch {
    if ($_.Exception.Message -notlike 'Cancelled without*') { throw }
}
if ($script:StopCount -ne 0) { throw 'C stopped a process' }

Reset-Case -Replies @('O', 'NO')
try {
    Select-LoopbackPort | Out-Null
    throw 'Unconfirmed O was accepted'
} catch {
    if ($_.Exception.Message -notlike 'Override cancelled*') { throw }
}
if ($script:StopCount -ne 0) { throw 'Unconfirmed O stopped a process' }

Reset-Case -Replies @('O')
$script:OwnerName = 'svchost.exe'
try {
    Select-LoopbackPort | Out-Null
    throw 'Protected process was accepted'
} catch {
    if ($_.Exception.Message -notlike 'Refusing to terminate protected*') {
        throw
    }
}
if ($script:StopCount -ne 0) { throw 'Protected process was stopped' }

Reset-Case -Replies @('O', 'OVERRIDE')
$selected = Select-LoopbackPort
if ($selected -ne 43881 -or $script:StopCount -ne 1) {
    throw 'Confirmed override did not release original port'
}
Write-Host 'Native installer P/C/O decision tests: PASS'
