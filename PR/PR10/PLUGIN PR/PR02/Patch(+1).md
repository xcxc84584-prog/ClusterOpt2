# PLUGIN PR02 — Patch(+1) / PR02.01
## Need
Establish executable, reusable API Descriptor Schema v1 before creating
Service/Provider routing. Old project has ObjectContract but no
self-describing external API schema.

## Changes
- APIDescriptorPolicy.js immutable self-contained shared Property.
- Register via LinkCore/HubUnit without bypassing EDPMU or URU.
- Negative validation tests + real Chromium LinkCore integration test.
- Separate PR02-specific GitHub Actions workflow, central registry entry.
- PRD/Plan/ArcD/Relation Test and versioned handoff.

## Security
No arbitrary executable code, file handle or plugin grant.
Reject unsupported versions, dangerous keys, deep trees, oversized
descriptors, schema mismatches. Same strict format for browser and Node.

## Rollback / Release
Original main f16efc9d864b086423b6dedb3df1453cdd9c02bf
and backup/pre-plugin-pr02-20261117. Main version unchanged.
Patch1 is not PR02-wide PASS; wait for latest exact-head CI.
