# PLUGIN PR04 Patch(+9) — Authorized route inspection
- Add RouteQueryPolicy with bounded strict selectors, pagination.
- HubUnit.inspectRoutes: list/describe only caller-owned routes.
- Preview uses live URU resolver and checks ACL for every stage;
  never calls receive, leaks payload, mutates state or alters dependency.
- RouteReadFacade exposes browser Cluster.routes read methods only.
- Node/VTE and Chromium tests; no public configuration API.
