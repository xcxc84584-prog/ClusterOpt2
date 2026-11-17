# PR13 Plan — Dynamic user-installed plugins

## Goal
Support user-authored plugins, but statically enforce the API surface and
permissions. No parallel plugin registry; URU owns runtime object/provider
identity, HubUnit routes calls and permissions, OMU audits, and EDPMU owns
global properties.

## Delivery sequence
| Sub-PR | Deliverable | Priority | Gate |
| --- | --- | --- | --- |
| 13.1 | Untrusted JSON package manifest and contract validation | P0 | Schema tests + VTE |
| 13.2 | Explicit local file/folder selection and package install | P0 | Gesture + atomic rollback |
| 13.3 | Worker isolation, message protocol and RPC bridge | P0 | CSP/browser tests |
| 13.4 | HubUnit capability ACL and user authorization | P0 | Deny-by-default |
| 13.5 | Timeouts, termination, failure EHU and recovery | P1 | Fault injection |
| 13.6 | Upgrade, disable, uninstall, dependency graph | P1 | No orphan references |
| 13.7 | CI/VTE/browser security regression | P0 | All event chains pass |
| 13.8 | IndexedDB package store, restore and export/import | P1 | Integrity and reload |

## PR13.1
A plugin package manifest is plain JSON with packageVersion, name,
relative entry path, and the existing Provider Manifest v1. Parse without
running any code, reject unknown fields and unsafe entry paths, and require
worker isolation for user-authored plugins. Provider Contract remains the
source of service declaration rules.

### Example
```json
{
  "packageVersion": 1,
  "name": "My Lexer",
  "entry": "dist/worker.js",
  "provider": {
    "manifestVersion": 1,
    "providerId": "author.lexer",
    "objectId": "Author.Lexer",
    "provides": [{
      "service": "editor.syntax.tokens",
      "action": "tokenize",
      "version": "1.0.0",
      "inputSchema": {"type": "object"},
      "outputSchema": {"type": "object"}
    }],
    "requires": [],
    "permissions": [],
    "execution": {"isolation": "worker", "concurrency": "per-slice"}
  }
}
```

## Threats and load
- Manifest at most 64 KiB; existing Provider Manifest limit is 32 KiB.
- Block traversal, absolute paths, URLs, backslash paths and executable
  metadata. Contract failure is fail-closed before registration.
- No capability grant on parsing; user approval at PR13.4.
- Package bytes, module graph, package hash/signature and storage limits
  require later PR13.2/13.3/13.8 validation.
- No unbounded scheduler or extra registration cache.

## Release
Sub-PR patches remain on one PR13 Draft branch. A major-PR release
requires version sync, CI, browser acceptance, and a backup ref before
merging main.

## PR13 Patch(+2) integration progress
- PR13.2: browser directory-handle intake with bounded manifest and entry
  reads. Returns staged data, does not execute code or register a Provider.
- PR13.3: RPC envelope contract validator for bounded request/response
  messages, ID correlation, declared service and action checks.
- PR13.4: immutable explicit approval review, deny Core and unknown grants.
- Host-only LinkCore staging method; no public untrusted invocation API.

### Acceptance still required
External plugin isolation/runtime and UI installation are incomplete.
A same-origin Worker is not an adequate untrusted-code sandbox.
Do not call 13.2–13.4 complete or grant untrusted plugins until an
isolated origin/channel and browser adversarial tests exist.
