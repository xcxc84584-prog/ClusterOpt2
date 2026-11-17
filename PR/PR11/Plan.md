# PR11 — OCDA Multi-language Highlighter Plugin
## PRD
Offer a downloadable sample multi-language syntax highlighter in Resources
left pane and a reviewed source-path mount control in Resources right pane.
Use existing HubUnit, URU and OMU; do not create a shadow registry.

## Scope (Patch +1)
- Source text only, up to 65,536 UTF-16 code units per request.
- JavaScript, TypeScript, Python, C/C++, Java, CSS, HTML, JSON and SQL.
- Language-specific comment rules, strings, keywords, numbers and operators.
- One UI preview with editable test filename and bounded text.
- Exported module download, data-only Provider manifest, reversible dynamic
  registration and HubUnit service routing.
- Maintain original Plugin List / permissions and API / EHU export behavior.

## Explicitly not completed
- Live editor syntax overlay, slice-level incremental invalidation,
  multi-GiB document tokenization, arbitrary external plugin execution,
  and isolated third-party Worker loading are not implemented in Patch +1.
- Do not claim E2E or CI success without recorded job results.

## Design references
- highlightjs/highlight.js (BSD-3-Clause): grammar registration/token classes.
- PrismJS/prism (MIT): token categories and language-specific patterns.
Implementation is independently authored without copying upstream code.

## Security
Untrusted local paths and external URLs are blocked; only a reviewed
same-origin bundled sample can be imported. Source never becomes innerHTML.
Provider registration fails closed and does not persist across reload.
Module runs with host authority and is therefore trusted-only.

## Load, throughput and parallelism
Bound text size to 64 Ki code units; Tokenizer is pure per request.
Independent requests can be parallelized through Hub scheduling, although
execution is currently in-process and not a dedicated Worker thread.
A future editor adapter must preserve revision cancellation, viewport
budgeting and background execution to avoid editing stalls.

## Acceptance
1. Token concatenation exactly equals the input for each language.
2. Non-matching comment delimiters are not misclassified.
3. Oversized requests fail with HTTP-style 413/EHU through HubUnit.
4. Repeated mount is idempotent; conflicts and failed registration roll back.
5. UI preview uses safe textContent and palette-aligned token styles.
6. Verify browser E2E, VTE event chain and CI before merging.
