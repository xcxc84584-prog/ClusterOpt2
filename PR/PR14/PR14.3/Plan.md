# PR14.3 Plan — Isolated UI extension

## Source review
- Legacy reference: `Cluster/plugin_ai_agent/agent.js`,
  `plugin_ai_agent/agent.css`, `permissions-ui.js`.
- Current architecture: PR13 UI `uiEntry` metadata was staged only,
  `PluginHostInstallUnit` had no UI mount lifecycle.
- Read latest PR14.2 handoff, PR13 v13.14, global Property registry.

## Implementation
New generic plugin loader extension:
`Implementation/LinkCore/PluginUIHostUnit.js`.

Given an explicitly validated installed plugin folder:
- Create a host-owned button in existing `.header-utility`, right after
  `#explorerPowerShell` in default DOM order.
- Create a bounded iframe pane inside `#workspace`.
- Use sandbox=allow-scripts *without* allow-same-origin and an injected
  frame-local CSP denying network, forms, frames, object and navigation.
- Load HTML only from the validated folder snapshot, never host DOM.
- Read optional language JSON files, forward read-only locale content
  into frame. Observe document root `lang` change, not a duplicated
  Language authority.
- Hide pane on workbench/PowerShell navigation.
- Disable/uninstall/upgrade uses existing installer lifecycle and
  returns UI resources.

Plugin files:
- `index.html` standalone isolated bilingual view (legacy visual cues).
- `locales/en.json` and `locales/zh-Hant.json`.
- Manifest `uiEntry` points to `index.html`.
- Worker retains PR14.2 read-only contract only.

## Performance
- Each installed provider owns at most one iframe, one button and
  one MutationObserver, removed together.
- HTML source <=256 KiB; locale text <=16 KiB each; no polling.
- UI controls for pairing/AI model/shell are disabled until PR14.4+.

## Risk / remaining
- Current UI is a functional shell, not full old AI behavior.
- Host document palette tokens apply to outer control; iframe uses
  old-style dark palette until explicitly translated via future UI theme
  bridge. Frame cannot access parent CSS variables.
- No frame-to-host execution transport. Only host-to-frame locale
  messaging; messages from frame cannot grant authority.
- True browser E2E and CI are required; static code review is not PASS.
