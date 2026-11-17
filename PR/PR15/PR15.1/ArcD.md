# PR15.1 — Architecture / Event Chain

```text
User -> Resources catalogue (AI Agent card)
  -> [Download ZIP] -> same-origin fetch (15 static assets)
  -> ZIP creation -> user download (no execution)
  -> [Mount folder] -> PluginFolderPackageUnit.selectAndStage
  -> PluginFolderPackagePolicy -> browser consent
  -> PluginHostInstallUnit -> URU / HubUnit / OMU
```

## Object / Property inventory
No new OCDA Object or global Property is introduced. Reuse the existing
Resources UI, PluginFolderPackageUnit, PluginHostInstallUnit and URU.
New static browser publisher: plugin-agent-download.js (bounded ZIP generator).

## EHU
Failed downloads are surfaced in Resources without execution. Install failures
remain logged by existing PluginFolderPackage and PluginHostInstall objects.
Only a trusted user interaction can initiate the native directory picker.
