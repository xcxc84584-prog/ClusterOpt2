# PLUGIN PR02 Patch(+5) — Internal Catalog Queries
Major PR 2 / Small PR 5.
Added CatalogQuery.js pure bounded list/describe/query with safe selector,
owner filter, text search, deterministic page offset, 400/404/409 errors.
Integrated internal LinkCore catalogQuery. Added Node and Chromium tests,
dedicated workflow triggers and updated PRD/Plan/ArcD/Relation Test.
No browser/public API, permission grant, mutation or file write; PR02.06
will add HubUnit-authorized visibility projection before public use.
Exact-head CI pending. Production version unchanged. PR02 Draft.
