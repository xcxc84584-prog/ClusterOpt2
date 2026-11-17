# PR14.4 Relation Test matrix

| Case | Expected | Status |
| --- | --- | --- |
| Policy validates 64 hex token | PASS | Node case added |
| Rejects malformed network message | 400/403 | Node case added |
| Without network grant | 403 EHU, no WebSocket | VTE case added |
| Host prompts for token only when approved | No frame token | VTE case added |
| Invalid token | 400, no WebSocket | VTE case added |
| Correct auth -> ready | 200 | Mock transport case added |
| Authenticated ping -> pong | 200 | Mock transport case added |
| Disconnect | 200 and socket closed | Mock transport case added |
| Unsolicited tool_call | 403 and disconnect | Mock transport case added |
| Revocation | 403 on next operation | VTE case added |
| Wrong browser Origin | server 403 | NOT RUN (Windows) |
| Actual old Agent handshake | ready / pong | NOT RUN (Windows) |
| Browser iframe cannot read token | denied | NOT RUN |
| Browser page-host prompt UI | pairing usable | NOT RUN |
| Uninstall/failed upgrade cleanup | no open socket | NOT RUN |
| CI all green on latest SHA | PASS | Pending |

Cases added are not evidence of successful execution until CI
and browser run results are confirmed.
