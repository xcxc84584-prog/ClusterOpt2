# PR13 Patch(+9) — Dedicated Worker hard-timeout isolation

## Purpose
PR13.7 security hardening: untrusted self-contained plugin ES modules
must not share the host renderer's synchronous execution thread.

## Architecture
- Host still creates an opaque-origin iframe with sandbox=allow-scripts
  (never allow-same-origin).
- The iframe bootstrap creates a dedicated module Worker from a
  host-authored Blob script. The user module enters Worker via transferred
  private MessagePort and dynamic import(data:).
- Host HubUnit still checks URU live identity, action ACL, Provider
  schema and PluginPermissionUnit grants per invocation.
- Worker runtime has no parent DOM, and inherited CSP denies network
  connections. Timeout closes the port and removes the owning frame.
- Dynamic registration remains URU-only. Bridge holds disposable
  handles and pending RPC correlation only.

## EHU and EventChain
```text
Host install -> Hub-approved bootstrap -> opaque iframe
  -> trusted bootstrap -> dedicated Worker -> user module import
  -> ready on private MessagePort
HubUnit Request -> Provider schema/ACL -> Worker action
  -> Response schema -> HubUnit Response/OMU Log
Worker synchronous infinite loop -> host timeout 504
  -> close port -> terminate iframe/owned Worker -> OMU EHU
```

## Test changes
- Chromium test: synchronous `while(true)` inside plugin action must
  not block the host's timeout; expects 504, closed bridge, frame removed.
- Existing real-browser tests still cover normal module RPC, opaque
  parent denial, async timeout and CSP network denial.

## Qualification
This remains a candidate until final npm check, Playwright and workflow
status are PASS. It does NOT implement arbitrary relative multi-file
imports or full HTML UI folder runtime, so major PR13 release is still
blocked by the original scope. Full cross-browser approval is outstanding.

## Restore
Prior backup: backup/pr13-patch7-draft-20261117.
Patch branch: pr13/dynamic-plugin-manifest (Draft #58).
