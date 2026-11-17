param()

$ErrorActionPreference = 'Stop'
$installer = Join-Path $PSScriptRoot '..\local-agent\install-current.ps1'
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $installer, [ref]$tokens, [ref]$errors
)

if ($errors.Count -gt 0) {
    foreach ($item in $errors) {
        Write-Error ('PowerShell syntax error at line ' +
            $item.Extent.StartLineNumber + ': ' + $item.Message)
    }
    exit 1
}

$content = Get-Content -LiteralPath $installer -Raw
$rules = @{
    ParameterBlockCount = @($ast.FindAll({
        param($item)
        $item -is [System.Management.Automation.Language.ParamBlockAst]
    }, $true)).Count -eq 1
    InstallerFunctionCount = @($ast.FindAll({
        param($item)
        $item -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)).Count -eq 5
    NoForcedProcessStop = -not $content.Contains('Stop-Process')
    NoTokenLog = -not $content.Contains('RedirectStandardOutput')
    NoDuplicatedBody = @($content -split 'function Download-AgentFile').Count -eq 2
    HasVersionValidation = $content.Contains('[ValidatePattern(')
    UsesExpectedVersion = $content.Contains('$ExpectedVersion')
    UsesCurrentRepository = $content.Contains('ClusterOpt2/main/Implementation')
}
foreach ($name in $rules.Keys) {
    if (-not $rules[$name]) {
        throw ('Installer validation failed: ' + $name)
    }
}
Write-Host 'PowerShell installer syntax and structure: PASS'
