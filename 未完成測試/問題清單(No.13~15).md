# 未完成測試／問題清單 No.13–15

All items below are OPEN until evidence is attached.

| No. | Risk | Required validation |
| --- | --- | --- |
| 13.1 | Patch13 line geometry | Node/Hub and EHU cases, UTF-8 CRLF EOF |
| 14.1 | Browser viewport connection | Chrome/Edge zoom, scroll, tab, dirty protection |
| 14.2 | Shadow observer overhead | Compare on/off latency and memory |
| 15.1 | Atomic edit batch | Candidate failure cannot alter root or revision |
| 15.2 | Optimistic revision | Concurrent same-revision updates: 200 + 409 |
| 15.3 | Unicode | UTF-16 offsets, surrogate edges and UTF-8 roundtrip |
| 15.4 | Memory | 1 Mi units/slice, 64 slices, 128 ops enforced |
| 15.5 | Dirty close | EHU 409, no silent drop |
| 15.6 | Hub relations | OMU Request/Response, EHU, Dependency inspection |
| 15.7 | CI | npm run check and npm run test:e2e PASS |
| 15.8 | Durable persistence | Not implemented, Patch16+ |
| 15.9 | Full virtualized main editor | Not implemented, Patch16+ |

## Recovery
Production main stays at `34a2804882e55df7aa90892e13f31d7b74d45ce4`.
Patch15 stacks on Patch14, which stacks on Patch13. Merge in order
only after tests; never label PR8 PASS before complete six-layer
end-to-end acceptance.
