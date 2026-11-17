# PR14.3 Patch(+1) — Plugin UI activation support

## Changed
- NEW `Implementation/LinkCore/PluginUIHostUnit.js`:
  generic host-created button, pane, sandboxed srcdoc, Language sync,
  scoped lifecycle cleanup.
- FIX `Implementation/LinkCore/PluginHostInstallUnit.js`:
  UI extension mount only after authorized install; rollback on
  failed mount; disable/enable/uninstall/upgrade UI lifecycle.
- UPDATE AI Agent plugin.json: `uiEntry = index.html`.
- NEW `index.html`, `locales/zh-Hant.json`, `locales/en.json`.
- UPDATE PR14 contract snapshot fixture to include UI assets.
- NEW Chromium `pr14-ai-agent-ui.spec.js`.

## Core change justification
This is solely a plugin-loading architecture extension. It does not
alter HubUnit, URU, EDPMU, OMU, editor/Explorer algorithms or the
product version. No direct AI Agent code is imported into main.js.

## Current behavior
AI Agent button appears beside PowerShell after plugin install.
Click opens isolated view with connection setup, model controls and
task output layout. Nonfunctional privileged buttons remain disabled.
Language follows existing global Language Property.
On disable/uninstall the interface is hidden/removed.

## Acceptance
Manifest + contract tests and Chromium E2E added. Check CI and
live browser before declaring PASS.
