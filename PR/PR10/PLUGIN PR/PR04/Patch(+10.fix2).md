# PR04 Patch(+10.fix2) — Browser release assertion parity

Three existing PR03 Chromium tests still asserted obsolete release
0.0.9-pr9.patch9. Update only their expected version to 0.0.10,
matching ReleaseVersion.js, local-agent and package.json. Prior
Chromium exact-head attempt: 76 tests PASS, 3 release assertions FAIL.
Preserve the existing CI workflow set, do not merge until latest head
has five successful full workflows and verified restore.
