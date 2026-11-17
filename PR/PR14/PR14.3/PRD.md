# PR14.3 PRD — Plugin-owned AI Agent UI and language pack

## Goal
Replicate the original `xcxc84584-prog/Cluster` AI Agent layout inside
ClusterOpt2 **only when the plugin is installed and enabled**. Place
the AI button directly beside PowerShell, with an independent output pane.

## Security boundary
The plugin's HTML runs in an opaque-origin sandboxed iframe. The host
owns toolbar insertion and lifecycle; plugin code never receives DOM,
HubUnit instances, local agent credentials, Explorer handles or shell
access. All future privileged communication must use host-owned
capabilities and explicit authorization.

## Functional acceptance
- Install shows AI Agent toolbar button; absent plugin shows no button.
- Clicking opens a dedicated viewport and not an overlay on controls.
- zh-Hant/en language files sync to shared Language Property.
- UI follows host palette for the outer wrapper.
- Disable, uninstall, and failed upgrade cleanly hide/restore UI.
- No misleading model/pairing status or active commands yet.
- Preserve the PR14 Draft and release number.
