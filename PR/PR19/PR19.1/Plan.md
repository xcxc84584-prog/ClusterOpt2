# PR19.1 — CMD confirmation and 0.0.15a

Observed Windows CMD: after `Continue [Y,N]?Y`, setup immediately jumps to `[ERROR]` without downloading. Cause: `choice` returns ERRORLEVEL 1 for Y; when `%ROOT%` already exists the conditional mkdir is skipped and the next unconditional `if errorlevel 1 goto failed` misinterprets the stale 1.

Fix: explicitly branch on Y/N and put mkdir error handling inside the mkdir branch; never delete pre-existing user data. Keep existing P/C/O process consent and immutable helper pinning intact.

Release: use 0.0.15a from canonical ReleaseVersion, sync package.json and Implementation/local-agent/package.json, and allow 'a' suffix in PowerShell CMD filename validator. Avoid unrelated main/editor changes.

Verification: version parity / node tests / browser CI / Windows parsing. This PR does not claim real Windows installer E2E; user device remains final acceptance.
