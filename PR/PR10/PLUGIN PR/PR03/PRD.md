# PLUGIN PR03 — Universal Capability / Provider Registration
## Goal
Extensible Capability/Provider registration through existing LinkCore,
not specialized registries per highlighter, indexer, or slice engine.
Source: PLUGIN DESIGN PR LIST.md, PR03.01–03.10.

## Sub-PR order
01 canonical Capability ID; 02 Manifest; 03 URU bridge;
04 EDPMU shared Property; 05 ServiceRegistry;
06 trusted factory; 07 disable/unregister lifecycle;
08 contract/version negotiation; 09 health state; 10 VTE relation gate.

PR03.01 is intentionally only a pure identifier validator, not a
registration or runtime capability. Runtime routing belongs to PR04/05,
untrusted plugin isolation belongs to PR06.

## PR03 acceptance boundary
PR03 only introduces metadata registration, trusted local Factory
laziness, service candidates, claim checking, version negotiation
and health state. No dynamic route replacement, untrusted plugin
isolation, or editor/FileSystem Access integration is claimed.
PR03 completes only when ten implementation scopes and 5 exact-head
workflows are verified; PR03 release version changes only at major
BC gate, then package mirror/Runtime/UI/Git tag must match.
