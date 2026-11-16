# PR1 Plan

## Goal
Basic local file creation, opening, editing, saving, closing, tab switching,
document-operation progress, and line numbers. Reuse ClusterOpt's dark aesthetic
without copying its monolithic implementations.

## Examples
Open file A and file B, edit A, switch to B and back, save A, close B.
A newly created file is dirty until saved via the browser picker.

## Technical basis
Browser File System Access API (secure context, user-initiated picker);
UTF-8 decoding; textarea editor; in-memory document registry.

## Security
No API keys, no absolute paths, no automatic unauthorized disk writes.
User authorizes file access. Failed operations are logged in EHU.

## Load estimation
A file is read in stream chunks and the progress indicator reflects bytes
read for this operation. PR1 still assembles full text in memory.
PR7 will replace that with virtualized slices / P-tree and B+ tree index.

## Patch history
Patch(+1): Initial minimal editor and LinkCore skeleton.
