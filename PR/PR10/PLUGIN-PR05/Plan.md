# PLUGIN PR05 — Multi-language syntax highlighter sample

## PRD
Provide a downloadable, reviewed sample plugin through Resources (left).
Provide a source-path mount control through Resources (right), registering
the sample via existing LinkCore/HubUnit and URU. No alternate registry.

## Scope and current limitations
- Included standalone tokenizer: JS, TS, Python, C/C++, Java, CSS, HTML,
  JSON and SQL (basic lexical categories; not a full grammar engine).
- Bounded to 65,536 UTF-16 code units per request; token output can be
  rendered in the Resources preview.
- This patch **does not** replace the live editor renderer. Integration
  into editor viewport/slices requires a separate and tested adapter.
- Only the bundled reviewed same-origin module path can be mounted; arbitrary
  user file paths, URLs and external scripts remain blocked pending a secure
  package validation / isolation architecture.
- Plugins are volatile and must be mounted again after reload.

## Reference
- highlightjs/highlight.js (BSD-3-Clause): language grammar architecture,
  local browser highlighting, explicit language selection.
- PrismJS/prism (MIT): language-specific token categories and styles.
No third-party code is copied into the plugin.

## Data / load evaluation
Typical per-request load <= 64 Ki code units. Linear regex tokenization;
coalesced adjacent token spans. Resource preview is user-triggered only.
Do not synchronously tokenize full multi-GiB buffers. For future editor
integration, use viewport-only slices and stale-result cancellation.

## Security
Download is a static same-origin module. No arbitrary dynamic import,
CDN injection, eval, hard-coded keys or absolute local paths.
The mounted sample registers through existing URU and HubUnit.
