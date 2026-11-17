# PR02.08 — Authorized Catalog Documentation

## Scope
Generate deterministic JSON and Markdown from HubUnit-filtered, registered
caller discovery. No direct collection or EDPMU access in the entry point.
Produces in-memory strings only, never browser file writes or HTML injection.
JSON has schemaVersion 1; Markdown escapes markup in descriptions and names.
Hard 64 KiB UTF-8 output limit (413, no truncation); no unbounded generation.
Handles Public, Protected, Private and UserAPI/AgentAPI via HubUnit.
Does not expose window.Cluster.docs (public facade deferred to PR02.10).

## Acceptance
- Node: filtered documentation, stable output, unknown callers, invalid format,
  markdown injection and 413 overflow.
- Chromium: actual LinkCore, Public-only JSON and Markdown, existing facade.
- Dedicated Node/Chromium, OCDA, PR1 and Windows CI on exact-head commit.

Status: IMPLEMENTED; exact-head CI PENDING.
