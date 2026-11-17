# PLUGIN PR04 Patch(+10.fix1) — Stable-version compatibility

Exact-head CI exposed five historical test assertions that reject stable
SemVer and an installer format guard accepting only development builds.
Update catalog assertions, PR8/PR9 version patterns, CMD installer and
PowerShell ValidatePattern to accept standard x.y.z stable releases
alongside historical x.y.z-prN.patchN(.fixN) builds. Local-agent manifest
mirrors canonical release 0.0.10; no separate version authority added.
Fix one Chromium route-read test syntax closure. This change does NOT
weaken unsafe path validation or grant privileges. Rerun the existing
five workflows (Node/Chromium/PR01/PR02/PR03/Windows) at the new exact
head before merge; no new workflows or duplicate dispatch.
