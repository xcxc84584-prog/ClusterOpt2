# PR14.6 — Scoped Explorer ToolBox
## Scope
Keep core editor, Explorer, PowerShell and LinkCore algorithms unchanged.
Install a host-owned ToolBox at the top-right of the AI Agent workspace.
The user selects a directory with a native picker, the browser grants
read permission, and a second prompt requires an absolute path label.
The typed path is not a filesystem capability and is not verified by the
browser. Validate its shape and terminal folder name, then store the
browser handle in trusted host memory only.
## Authorization
All read, create, update and delete toggles default OFF. Write operations
require a separate browser readwrite permission. PowerShell remains OFF
until PR14.7. Revocation, disable and uninstall discard root handles.
## Budget and threat model
Limit read and write text to 1 MiB each, listing to 200 entries, path
depth to 12. Reject path traversal, absolute paths in operation payloads
and recursive deletion. Never transfer the handle or typed full path into
the iframe, Worker, model context or logs.
## Acceptance
VTE must cover default-deny, all CRUD toggles, traversal, revoke and path
redaction; Chromium must cover real folder picker and native permissions.
PR14 remains Draft until full PR14.10 acceptance.
