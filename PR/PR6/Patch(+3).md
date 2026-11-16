# PR6 Patch(+3) — Legacy Explorer UI
- Replaced the custom sidebar markup with the original ClusterOpt
  Explorer shell and matching IDs.
- Ported the original theme-driven Explorer CSS layout and top header
  toggle; preserved main editor and OCDA business logic.
- Reused File/Open picker, HubUnit list/activate and existing metadata.
- Added directory picker request entry, without claiming folder tree support.
- Added bilingual Explorer labels and browser regression coverage.
- Remaining: hierarchical tree, folder CRUD, reload protection,
  scroll viewport restoration, external sync and full integration tests.
Status: NOT PASS.
