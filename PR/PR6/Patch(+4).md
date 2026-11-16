# PR6 Patch(+4)
- Added lazy directory enumeration via native FileSystemHandle.values().
- Added recursive tree rendering using the original ClusterOpt UI classes.
- Added folder expansion, filter, and refresh-collapse behavior.
- Kept FileWorkspace as sole owner of open document buffers.
- Added HubUnit Request/Response and failure regression coverage.
- Pending: persistent directory grants, folder-file open, external CRUD,
  proper viewport recovery, full functional parity with original Explorer.
Status: PARTIAL / NOT PASS.
