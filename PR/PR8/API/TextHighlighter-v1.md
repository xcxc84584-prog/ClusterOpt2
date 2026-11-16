# TextHighlighter API — proposal v1

Status: specification only. Custom highlighting is not enabled.

## Contract
- Input: { apiVersion: 1, sliceId, revision, languageId, text }.
- Output: { apiVersion: 1, sliceId, revision, spans }.
- spans: [{ start, end, tokenClass }] in UTF-16 slice-local offsets.
- Spans may not change text or overlap invalid boundaries.
- Palette-derived CSS variables resolve token classes at render time.

## Security
- Do not accept arbitrary markup/HTML, remote CSS imports, URLs or JS.
- Validate tokenClass against a locally defined class registry.
- Render decorations as text spans, never innerHTML from plugins.
- Time and memory budgets apply to each visible slice.
- Invalid output returns EHU 400 and falls back to plain text.

## Lifecycle
register -> enable -> highlight -> disable -> unregister.
Preloaded chunks bypass highlighting.
