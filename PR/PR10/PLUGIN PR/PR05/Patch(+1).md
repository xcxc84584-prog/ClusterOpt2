# PR05.01–03 Patch1

Added RouteTransactionUnit (bounded pending candidates), immutable HubUnit route generation/snapshot, CAS guarded configureServiceRoutes with dry-run full validation, LinkCore host-only transaction facade. Service.Resolve log records routeVersion before asynchronous dispatch. Existing direct route configuration remains available but increments generation. New Node tests for snapshots, invalid candidate, CAS race, abort and non-public API. CI pending; do not merge this draft.
