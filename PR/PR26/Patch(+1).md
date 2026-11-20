# PR26 Patch(+1)

## Changes
- API List toolbar now has exactly one category selector and one
  search input. Five kinds of live contract remain accessible.
- Removed page-size/sort control widgets, capabilities panel,
  Manifest copy and full contract export from the API List.
- Result table, per-row lazy contract details and pagination preserved.
- CSS: horizontal responsive control row, sticky headers,
  readable table cells, dark-mode tokens and focus indicators.
- Resources: replaced former legacy capped API JSON export with
  SHA-256 verified full authorized export across five kinds.
- Plugin production ZIP: dynamically embedded live ACL-filtered
  API-CATALOG.json, official shipped SDK TypeScript definition,
  valid plugin.json with rpcScopes, runnable Cluster.handle Worker,
  HTML/CSS/JS, API/Manifest/Security guides and bilingual README.
- Download now aborts when SDK or live catalog is unavailable;
  old fallback source is never shipped to the user.
- Tests updated: API row semantics, relocation of export,
  ZIP manifest+types+catalog integrity.

## Compatibility
Existing URU/EDPMU, Host RPC, installer and SDK endpoints unchanged.
Full Template ZIP requires successful live authorized catalog read.
