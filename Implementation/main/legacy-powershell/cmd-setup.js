/**
 * ClusterOpt2 local-agent bootstrap. The version always comes from
 * LinkCore SystemVersion; do not hard-code a second UI version.
 */
export const PLA_SOURCE =
  "https://raw.githubusercontent.com/xcxc84584-prog/" +
  "ClusterOpt2/main/Implementation/local-agent/install-current.ps1";

export function setupFilename(version) {
  if (!/^\d+\.\d+\.\d+[a-z]?(?:-pr\d+\.patch\d+(?:\.fix\d+)?)?$/u.test(version)) {
    throw new TypeError("Invalid release version");
  }
  return "ClusterOpt2-PLA-Setup-" + version + ".cmd";
}

export function createSetupCmd({ version } = {}) {
  setupFilename(version);
  const lines = [
    "@echo off",
    "setlocal EnableExtensions DisableDelayedExpansion",
    "title ClusterOpt2 PowerShell Local Agent " + version,
    "echo ClusterOpt2 PowerShell Local Agent " + version,
    "set \"AGENT_DIR=%USERPROFILE%\\ClusterOpt2-Agent\"",
    "if not exist \"%AGENT_DIR%\" mkdir \"%AGENT_DIR%\"",
    "if errorlevel 1 goto failed",
    "echo [1/2] Downloading version-compatible setup helper...",
    "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command " +
      "\"$ErrorActionPreference='Stop'; " +
      "$dest=Join-Path $env:USERPROFILE 'ClusterOpt2-Agent'; " +
      "$file=Join-Path $dest 'install-current.ps1'; " +
      "Invoke-WebRequest -UseBasicParsing -Uri '" + PLA_SOURCE +
      "' -OutFile $file -TimeoutSec 45; " +
      "if((Get-Item $file).Length -lt 1000){throw 'Incomplete setup'}\"",
    "if errorlevel 1 goto failed",
    "echo [2/2] Installing native agent...",
    "powershell.exe -NoProfile -ExecutionPolicy Bypass " +
      "-File \"%AGENT_DIR%\\install-current.ps1\" " +
      "-ExpectedVersion \"" + version + "\"",
    "if errorlevel 1 goto failed",
    "echo ClusterOpt2 agent setup complete. Background agent remains running.",
    "exit /b 0",
    ":failed",
    "echo [ERROR] Setup failed; no existing listener was terminated.",
    "pause",
    "exit /b 1"
  ];
  return lines.join("\r\n") + "\r\n";
}
