# PR21.2 Plan — direct Local Agent Port/Token pairing

## PRD
Screenshots show (1) PS CPO O blocked after PID change, (2) MCP CMD finishes fetching five file labels but exits unsuccessfully without identifying the failing file, and (3) an inert readonly token preview in plugin setup. Replace (3) with functional adjacent Port 25% and Token 75% fields, direct pairing on submit.

## Solution
Use a *trusted host-side* form geometrically anchored to a reserved iframe slot rather than forwarding the secret through an untrusted plugin iframe. Port defaults to 43881, accepts 1024–65535; token is 64 hexadecimal characters. Submit stages a single-use credential in trusted PluginLocalAgentObject then calls HubUnit with empty pair payload. Clear credentials after use. Retain normal browser permission controls, auditing, and shell authorization.

On PS override changed-PID fail closed and return to CPO prompt without terminating an unrelated process. MCP CMD uses an isolated per-file download subroutine, exposing failure name, URL, and underlying network or file error.

## Constraints
No absolute paths, no keys in source, no storage of pairing token, no editor / HubUnit / URU / OMU change. Browser viewport/scroll and old tests must adapt. Unit, E2E, and Windows PS syntax checks before merge.
