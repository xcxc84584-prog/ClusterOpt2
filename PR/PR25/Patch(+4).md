# PR25 Patch(+4) — Finalization efforts

- Export now resolves every descriptor via authorized lazy describe.
- All five category revisions and counts checked before and after SHA256.
- EDPMU Worker SessionChange Event includes trigger, payload, subscribe,
  unsubscribe, order and source location.
- Static CI checks UICO, Hub Protocol and Worker Event versions; EHU has
  owner, API ID, file, line and mismatch code.
- Protocol metadata has semantic version and HostInternal audience.
- Search covers Service/Protocol schemas; UI shows selected live grants
  and exact RPC scopes, and copies official plugin Manifest.
- API tab checks live revision while open without replacing search DOM.
- Rich schema validation now supports const, pattern, defaults, min/max
  lengths and array item limits; exact rpcScopes and migration metadata.
- Tests cover third-party documentation-only Worker package, Session
  ready and RPC, all-kind export, revocation and live tab refresh.
- Existing deprecated descriptors remain backward compatible.

Acceptance still requires a full formal API inventory and a human blind
test. An automated plugin fixture does not establish human acceptance.
Branch remains Draft, main unchanged until acceptance and CI verification.
