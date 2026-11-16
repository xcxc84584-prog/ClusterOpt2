# PR8 Patch(+20): Explorer CRUD and context actions

## Purpose
Restore the legacy Explorer's file/folder creation, rename, cut, copy,
paste and delete entry points without bypassing HubUnit.

## Implementation
- ExplorerEntryPolicy: filename safety and collision checks.
- Explorer: Hub Request/Response createFile/createFolder/renameEntry,
  deleteEntry/copyEntry/cutEntry/pasteEntry.
- UI: compact right-click action toolbar with localized controls.
- Existing tabs and active file identity remain owned by FileWorkspace.
- Destructive mutations refuse open documents and require confirmation.
- Native file move is preferred; local-file fallback copies to a fresh
  name and verifies every byte in bounded blocks before removing source.
- Folder rename remains unsupported (501); folder paste remains 501.
- File copy/paste supports files only; directory copy/paste returns 501.
- Clipboard is in-memory only; no persisted handles or credentials.

## Security and performance
- Reject paths/traversal and existing destinations.
- Writable permissions enforced by browser File System Access API.
- File paste uses Blob-backed file writes, with no JS string conversion.
- Rename fallback compares source and target in 1 MiB chunks.
- Directory enumerations are O(entries), file copy O(file bytes).
- Failure after target creation may leave a partial destination, but
  source is never deleted until write close resolves.
- VTE and actual browser permission/lock/rename tests are required.

## Status
IMPLEMENTED ON FEATURE BRANCH — NOT ACCEPTED, NOT MERGED.
