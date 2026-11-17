# PR19.1 Architecture

UI Agent button -> PluginUIHostUnit -> downloadAgentQuickSetup -> Quick-Setup.cmd
Quick-Setup.cmd -> choice [Y=1,N=2] -> confirmed -> conditional mkdir
  -> download pinned Setup-Quick.ps1 -> P/C/O -> loopback Agent

No new OCDA Object/Property. ReleaseVersion remains single source of truth. PowerShell CMD filename validator allows alphabetic patch suffix. OMU/EHU untouched; installer errors remain terminal output.
